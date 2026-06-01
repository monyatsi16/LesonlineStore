import { storage } from "./storage";
import { applyPricingUpdateForProduct, type PricingUpdateOutcome } from "./pricing";
import { isPricingModelReady } from "./training";
import { getCompetitorPricing } from "./competitor-pricing";

const MIN_PRICING_INTERVAL_MS = 15 * 60 * 1000;
const MAX_PRICING_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_PRICING_INTERVAL_MS = MIN_PRICING_INTERVAL_MS;
const configuredInterval = Number(process.env.PRICING_INTERVAL_MS || DEFAULT_PRICING_INTERVAL_MS);
const PRICING_INTERVAL_MS = Number.isFinite(configuredInterval)
  ? Math.min(MAX_PRICING_INTERVAL_MS, Math.max(MIN_PRICING_INTERVAL_MS, configuredInterval))
  : DEFAULT_PRICING_INTERVAL_MS;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let targetRunTime: number | null = null;
let isRunning = false;
let hasRunLock = false;

type UpdateEntry = {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  confidence: number;
  trend: string;
};

type SkippedEntry = {
  productId: number;
  productName: string;
  currentPrice: number;
  recommendedPrice: number;
  confidence: number;
  changePct: number;
  skipReason: string;
};

function toUpdateEntry(outcome: PricingUpdateOutcome): UpdateEntry {
  return {
    productId: outcome.productId,
    productName: outcome.productName,
    oldPrice: outcome.previousPrice,
    newPrice: outcome.recommendedPrice,
    confidence: outcome.confidence,
    trend: outcome.trend,
  };
}

function toSkippedEntry(outcome: PricingUpdateOutcome): SkippedEntry {
  return {
    productId: outcome.productId,
    productName: outcome.productName,
    currentPrice: outcome.previousPrice,
    recommendedPrice: outcome.recommendedPrice,
    confidence: outcome.confidence,
    changePct: outcome.changePct,
    skipReason: outcome.skipReason || "Skipped by scheduler thresholds",
  };
}

async function executeUpdate(): Promise<{
  productsAnalyzed: number;
  productsUpdated: number;
  updates: UpdateEntry[];
  skipped: SkippedEntry[];
}> {
  console.log(`[Price Scheduler] Starting pricing cycle (${PRICING_INTERVAL_MS / 1000}s interval)...`);

  const allProducts = await storage.getAllProducts();
  const updates: UpdateEntry[] = [];
  const skipped: SkippedEntry[] = [];

  for (const product of allProducts) {
    try {
      // Use cached competitor price only — never trigger live scraping in the scheduler.
      // Live scrapes are expensive (20s/product × 331 products) and would block every cycle.
      // Scraping happens naturally when product pages are viewed.
      let competitorPrice: number | undefined;
      try {
        const competitorData = await getCompetitorPricing(product, { allowLiveScrape: false });
        if (competitorData.avgCompetitorPrice > 0) {
          competitorPrice = competitorData.avgCompetitorPrice;
        }
      } catch {
        // Competitor fetch failure must never abort the pricing cycle
      }

      const outcome = await applyPricingUpdateForProduct(product.id, {
        source: "scheduler",
        competitorPrice,
      });

      if (outcome.updated) {
        updates.push(toUpdateEntry(outcome));
      } else {
        skipped.push(toSkippedEntry(outcome));
      }
    } catch (error) {
      console.error(`[Price Scheduler] Error processing product ${product.id}:`, error);
      skipped.push({
        productId: product.id,
        productName: product.name,
        currentPrice: product.price,
        recommendedPrice: product.price,
        confidence: 0,
        changePct: 0,
        skipReason: `Error during price prediction: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  const nextRunAt = new Date(Date.now() + PRICING_INTERVAL_MS);

  await storage.createPriceUpdateLog({
    productsAnalyzed: allProducts.length,
    productsUpdated: updates.length,
    totalPriceChanges: updates.reduce((sum, update) => sum + Math.abs(update.newPrice - update.oldPrice), 0),
    status: "completed",
    details: { updates, skipped },
    nextRunAt,
  });

  console.log(
    `[Price Scheduler] Completed: ${allProducts.length} analyzed, ${updates.length} updated, ${skipped.length} skipped.`,
  );

  return {
    productsAnalyzed: allProducts.length,
    productsUpdated: updates.length,
    updates,
    skipped,
  };
}

function updateNextRunTime(from: number = Date.now()): void {
  targetRunTime = from + PRICING_INTERVAL_MS;
}

function clearScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

function tryAcquireRunLock(): boolean {
  if (hasRunLock || isRunning) {
    return false;
  }

  hasRunLock = true;
  isRunning = true;
  return true;
}

function releaseRunLock(): void {
  hasRunLock = false;
  isRunning = false;
}

async function runScheduledCycle(): Promise<void> {
  if (!tryAcquireRunLock()) {
    updateNextRunTime();
    return;
  }

  try {
    await executeUpdate();
  } catch (error) {
    console.error("[Price Scheduler] Auto-update failed:", error);
    await storage.createPriceUpdateLog({
      productsAnalyzed: 0,
      productsUpdated: 0,
      totalPriceChanges: 0,
      status: "failed",
      details: { updates: [], skipped: [] },
      nextRunAt: new Date(Date.now() + PRICING_INTERVAL_MS),
    });
  } finally {
    releaseRunLock();
    updateNextRunTime();
  }
}

export async function runAutoPriceUpdate(): Promise<{
  productsAnalyzed: number;
  productsUpdated: number;
  updates: UpdateEntry[];
  skipped: SkippedEntry[];
}> {
  if (!tryAcquireRunLock()) {
    throw new Error("A price update is already in progress. Please wait for it to finish.");
  }

  try {
    const result = await executeUpdate();
    updateNextRunTime();
    return result;
  } finally {
    releaseRunLock();
  }
}

export async function initPriceScheduler(): Promise<void> {
  clearScheduler();
  updateNextRunTime();

  schedulerTimer = setInterval(() => {
    void runScheduledCycle();
  }, PRICING_INTERVAL_MS);

  console.log(`[Price Scheduler] Running every ${Math.round(PRICING_INTERVAL_MS / 60000)} minute(s) for scheduled dynamic pricing.`);

  void runScheduledCycle();
}

export function getSchedulerStatus(): {
  isActive: boolean;
  isRunning: boolean;
  nextRunAt: string | null;
  remainingMs: number | null;
  intervalMs: number;
} {
  return {
    isActive: schedulerTimer !== null,
    isRunning,
    nextRunAt: targetRunTime ? new Date(targetRunTime).toISOString() : null,
    remainingMs: targetRunTime ? Math.max(0, targetRunTime - Date.now()) : null,
    intervalMs: PRICING_INTERVAL_MS,
  };
}

import type { Product } from "../shared/schema";
import { storage } from "./storage";
import { getPriceRecommendation, type PricingResult } from "./pricing-model";
import { invalidatePricePredictionCache, isPricingModelReady } from "./training";
import { getMarketInsights } from "./pricing-model";
import { db } from "./db";
import { priceRecommendations } from "../shared/schema";
import { desc, eq } from "drizzle-orm";
import { publishPriceChange } from "./price-events";

export type PricingUpdateSource =
  | "scheduler"
  | "productViewed"
  | "stockChanged"
  | "competitorPriceChanged";

export interface PricingUpdateOutcome {
  productId: number;
  productName: string;
  previousPrice: number;
  recommendedPrice: number;
  confidence: number;
  trend: "up" | "down" | "stable";
  reason: string;
  source: PricingUpdateSource;
  updated: boolean;
  changePct: number;
  skipReason?: string;
}

type PricingUpdateOptions = {
  source: PricingUpdateSource;
  competitorPrice?: number;
  forceApply?: boolean;
};

async function buildFallbackPricingResult(product: Product): Promise<PricingResult> {
  const orderCount = await storage.getOrderCount(product.id);
  const currentPrice = product.price;
  const floorPrice = Math.max(product.costPrice * (1 + MIN_MARGIN), 200);
  const now = new Date();
  const hourCycle = Math.cos((now.getHours() / 24) * 2 * Math.PI);

  let adjustmentPct = 0;
  const reasons: string[] = [];

  if (product.stock < 10) {
    adjustmentPct += 0.012;
    reasons.push(`Low stock (${product.stock} units)`);
  } else if (product.stock > 80) {
    adjustmentPct -= 0.008;
    reasons.push(`High stock (${product.stock} units)`);
  }

  if (product.views > 120) {
    adjustmentPct += 0.01;
    reasons.push(`High demand (${product.views} views)`);
  } else if (product.views < 15) {
    adjustmentPct -= 0.006;
    reasons.push(`Low demand (${product.views} views)`);
  }

  if (orderCount >= 5) {
    adjustmentPct += 0.01;
    reasons.push(`Strong sales (${orderCount} orders)`);
  } else if (orderCount === 0) {
    adjustmentPct -= 0.004;
    reasons.push("No sales yet");
  }

  adjustmentPct += hourCycle * 0.0015;

  if (Math.abs(adjustmentPct) < 0.003) {
    adjustmentPct = adjustmentPct >= 0 ? 0.0035 : -0.0035;
  }

  const recommendedPrice = Number(Math.max(floorPrice, currentPrice * (1 + adjustmentPct)).toFixed(2));
  const trend: "up" | "down" | "stable" = recommendedPrice > currentPrice ? "up" : recommendedPrice < currentPrice ? "down" : "stable";
  
  const reasonText = reasons.length > 0 ? reasons.join(". ") + "." : "Dynamic pricing applied";

  return {
    productId: product.id,
    productName: product.name,
    currentPrice,
    recommendedPrice,
    confidence: 0.68,
    reason: reasonText,
    trend,
    modelVersion: "fallback-runtime",
    factors: {
      demandScore: Math.min(1, product.views / 100),
      competitorScore: 0,
      stockScore: product.stock < 10 ? 1 : product.stock > 80 ? 0.2 : 0.5,
      categoryScore: 0.5,
      marginScore: Math.max(0, (currentPrice - product.costPrice) / Math.max(currentPrice, 1)),
    },
  };
}

const DEFAULT_MIN_MARGIN = 0.14;
const DEFAULT_COMPETITOR_PREMIUM_CAP = 0.08;
const DEFAULT_COMPETITOR_DISCOUNT_CAP = 0.15;
const DEFAULT_CATEGORY_PREMIUM_CAP = 0.35;
const DEFAULT_COOLDOWN_MINUTES = 120;
const DEFAULT_COOLDOWN_BYPASS_CHANGE_PCT = 0.1;

const MIN_MARGIN = Number(process.env.PRICING_MIN_MARGIN ?? DEFAULT_MIN_MARGIN);
const COMPETITOR_PREMIUM_CAP = Number(process.env.PRICING_COMPETITOR_PREMIUM_CAP ?? DEFAULT_COMPETITOR_PREMIUM_CAP);
const COMPETITOR_DISCOUNT_CAP = Number(process.env.PRICING_COMPETITOR_DISCOUNT_CAP ?? DEFAULT_COMPETITOR_DISCOUNT_CAP);
const CATEGORY_PREMIUM_CAP = Number(process.env.PRICING_CATEGORY_PREMIUM_CAP ?? DEFAULT_CATEGORY_PREMIUM_CAP);
const COOLDOWN_MINUTES = Number(process.env.PRICING_COOLDOWN_MINUTES ?? DEFAULT_COOLDOWN_MINUTES);
const COOLDOWN_BYPASS_CHANGE_PCT = Number(
  process.env.PRICING_COOLDOWN_BYPASS_CHANGE_PCT ?? DEFAULT_COOLDOWN_BYPASS_CHANGE_PCT,
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getStepCaps(source: PricingUpdateSource): { up: number; down: number } {
  switch (source) {
    case "scheduler":
      return { up: 0.08, down: 0.06 };
    case "competitorPriceChanged":
      return { up: 0.12, down: 0.10 };
    case "stockChanged":
      return { up: 0.10, down: 0.08 };
    case "productViewed":
    default:
      return { up: 0.06, down: 0.05 };
  }
}

export async function getLatestRecommendation(productId: number): Promise<(typeof priceRecommendations.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(priceRecommendations)
    .where(eq(priceRecommendations.productId, productId))
    .orderBy(desc(priceRecommendations.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function applyPolicyGuardrails(
  product: Product,
  candidatePrice: number,
  options: PricingUpdateOptions,
): Promise<{ price: number; notes: string[]; skipReason?: string }> {
  const notes: string[] = [];
  let price = Number(candidatePrice);

  const floor = Math.max(product.costPrice * (1 + MIN_MARGIN), 200);
  if (price < floor) {
    price = floor;
    notes.push(`raised to margin floor (${(MIN_MARGIN * 100).toFixed(0)}%)`);
  }

  const marketStats = getMarketInsights(product.category);
  if (marketStats) {
    const categoryCeiling = Math.max(floor, marketStats.q75 * (1 + CATEGORY_PREMIUM_CAP));
    if (price > categoryCeiling) {
      price = categoryCeiling;
      notes.push("capped by category price envelope");
    }
  }

  const competitorPrice = options.competitorPrice;
  if (typeof competitorPrice === "number" && Number.isFinite(competitorPrice) && competitorPrice > 0) {
    const competitorFloor = Math.max(floor, competitorPrice * (1 - COMPETITOR_DISCOUNT_CAP));
    const competitorCeiling = Math.max(competitorFloor, competitorPrice * (1 + COMPETITOR_PREMIUM_CAP));

    if (price < competitorFloor) {
      price = competitorFloor;
      notes.push("aligned upward to avoid excessive undercut vs competitor");
    }
    if (price > competitorCeiling) {
      price = competitorCeiling;
      notes.push("aligned downward to stay near competitor market band");
    }
  }

  const stepCaps = getStepCaps(options.source);
  const minStepPrice = product.price * (1 - stepCaps.down);
  const maxStepPrice = product.price * (1 + stepCaps.up);
  const steppedPrice = clamp(price, minStepPrice, maxStepPrice);
  if (steppedPrice !== price) {
    notes.push("change capped by max per-cycle movement");
  }
  price = steppedPrice;

  const latest = await getLatestRecommendation(product.id);
  if (!options.forceApply && latest?.createdAt) {
    const ageMs = Date.now() - new Date(latest.createdAt).getTime();
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
    const changePct = Math.abs(price - product.price) / Math.max(product.price, 1);
    const competitorShock =
      typeof competitorPrice === "number" && Number.isFinite(competitorPrice) && competitorPrice > 0
        ? Math.abs(product.price - competitorPrice) / Math.max(competitorPrice, 1)
        : 0;
    const canBypassCooldown = changePct >= COOLDOWN_BYPASS_CHANGE_PCT || competitorShock >= 0.25;

    if (ageMs < cooldownMs && !canBypassCooldown) {
      return {
        price: Number(price.toFixed(2)),
        notes,
        skipReason: `Cooldown active (${Math.ceil((cooldownMs - ageMs) / 60000)} min remaining)`,
      };
    }
  }

  return { price: Number(price.toFixed(2)), notes };
}

function deriveTrend(currentPrice: number, recommendedPrice: number): "up" | "down" | "stable" {
  const priceDiff = recommendedPrice - currentPrice;

  if (priceDiff > currentPrice * 0.02) {
    return "up";
  }

  if (priceDiff < -currentPrice * 0.02) {
    return "down";
  }

  return "stable";
}

function applyCompetitorSignal(
  product: Product,
  result: PricingResult,
  competitorPrice?: number,
): PricingResult {
  if (typeof competitorPrice !== "number" || !Number.isFinite(competitorPrice) || competitorPrice <= 0) {
    return result;
  }

  const competitorCap = Math.max(product.costPrice * 1.1, competitorPrice * 0.98);
  if (competitorCap >= result.recommendedPrice) {
    return result;
  }

  const adjustedPrice = Number(competitorCap.toFixed(2));
  return {
    ...result,
    recommendedPrice: adjustedPrice,
    trend: deriveTrend(product.price, adjustedPrice),
    reason: `Competitor price changed to M${competitorPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}. ${result.reason}`,
  };
}

function getThresholds(source: PricingUpdateSource): { minConfidence: number; minChangePct: number } {
  switch (source) {
    case "scheduler":
      return { minConfidence: 0.65, minChangePct: 0.003 };
    case "competitorPriceChanged":
      return { minConfidence: 0.55, minChangePct: 0.01 };
    default:
      return { minConfidence: 0.6, minChangePct: 0.02 };
  }
}

export async function predictProductPrice(product: Product): Promise<PricingResult> {
  if (!isPricingModelReady()) {
    return buildFallbackPricingResult(product);
  }
  return getPriceRecommendation(product);
}

export async function applyPricingUpdateForProduct(
  productId: number,
  options: PricingUpdateOptions,
): Promise<PricingUpdateOutcome> {
  const product = await storage.getProduct(productId);
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  invalidatePricePredictionCache(product.id);

  const rawPrediction = await predictProductPrice(product);
  const competitorAdjusted = applyCompetitorSignal(product, rawPrediction, options.competitorPrice);
  const policyResult = await applyPolicyGuardrails(product, competitorAdjusted.recommendedPrice, options);
  const result: PricingResult = {
    ...competitorAdjusted,
    recommendedPrice: policyResult.price,
    trend: deriveTrend(product.price, policyResult.price),
    reason:
      policyResult.notes.length > 0
        ? `${competitorAdjusted.reason} Guardrails: ${policyResult.notes.join(", ")}.`
        : competitorAdjusted.reason,
  };
  const changePct = Math.abs(result.recommendedPrice - product.price) / Math.max(product.price, 1);
  const { minConfidence, minChangePct } = getThresholds(options.source);
  const thresholdPass = options.forceApply || (result.confidence >= minConfidence && changePct >= minChangePct);
  const shouldApply = thresholdPass && !policyResult.skipReason;

  if (shouldApply) {
    await storage.updateProductPrice(product.id, result.recommendedPrice);
    publishPriceChange({
      productId: product.id,
      newPrice: result.recommendedPrice,
      source: options.source,
      changedAt: new Date().toISOString(),
    });
  }

  // Keep one latest recommendation per product so dashboard stays stable during scheduler runs.
  await db.delete(priceRecommendations).where(eq(priceRecommendations.productId, product.id));

  await storage.createRecommendation({
    userId: product.userId,
    productId: product.id,
    productName: product.name,
    currentPrice: product.price,
    recommendedPrice: result.recommendedPrice,
    confidence: result.confidence,
    reason: result.reason,
    trend: result.trend,
  });

  return {
    productId: product.id,
    productName: product.name,
    previousPrice: product.price,
    recommendedPrice: result.recommendedPrice,
    confidence: result.confidence,
    trend: result.trend,
    reason: result.reason,
    source: options.source,
    updated: shouldApply,
    changePct,
    skipReason: shouldApply
      ? undefined
      : policyResult.skipReason
        ? `Skipped ${options.source}: ${policyResult.skipReason}`
        : `Skipped ${options.source}: confidence ${(result.confidence * 100).toFixed(0)}% or change ${(changePct * 100).toFixed(1)}% below threshold`,
  };
}

export async function productViewed(productId: number): Promise<PricingUpdateOutcome> {
  return applyPricingUpdateForProduct(productId, { source: "productViewed" });
}

export async function stockChanged(productId: number): Promise<PricingUpdateOutcome> {
  return applyPricingUpdateForProduct(productId, { source: "stockChanged" });
}

export async function competitorPriceChanged(
  productId: number,
  competitorPrice: number,
): Promise<PricingUpdateOutcome> {
  return applyPricingUpdateForProduct(productId, {
    source: "competitorPriceChanged",
    competitorPrice,
  });
}

export function getPricingPolicyConfig() {
  return {
    minMargin: MIN_MARGIN,
    competitorPremiumCap: COMPETITOR_PREMIUM_CAP,
    competitorDiscountCap: COMPETITOR_DISCOUNT_CAP,
    categoryPremiumCap: CATEGORY_PREMIUM_CAP,
    cooldownMinutes: COOLDOWN_MINUTES,
    cooldownBypassChangePct: COOLDOWN_BYPASS_CHANGE_PCT,
    stepCaps: {
      scheduler: getStepCaps("scheduler"),
      productViewed: getStepCaps("productViewed"),
      stockChanged: getStepCaps("stockChanged"),
      competitorPriceChanged: getStepCaps("competitorPriceChanged"),
    },
  };
}

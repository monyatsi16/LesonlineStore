import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import puppeteer, { type Browser } from "puppeteer";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { products } from "../shared/schema";

type PipelineProduct = {
  id?: number;
  name: string;
  price: number;
  costPrice?: number;
  category?: string;
};

type SeedCostEntry = {
  normalizedName: string;
  tokens: string[];
  costPrice: number;
  category?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CJ_API_KEY = process.env.CJ_API_KEY || "";
const SEED_FILE = path.join(__dirname, "seed-data.json");
const OUTPUT_FILE = path.join(__dirname, "seed-data-costed.json");
const THRESHOLD = 0.03;

const argSet = new Set(process.argv.slice(2));
const WRITE_DB = argSet.has("--db");
const FORCE = argSet.has("--force");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : null;
const IDS_ARG = process.argv.find((arg) => arg.startsWith("--ids="));
const TARGET_IDS = IDS_ARG
  ? IDS_ARG
      .split("=")[1]
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0)
  : [];

const seedCostByName = new Map<string, number>();
const seedCostEntries: SeedCostEntry[] = [];
let warnedBrowserFallback = false;

function cleanName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim();
}

function parseNumberLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function tokenizeName(value: string): string[] {
  return cleanName(value)
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

function findClosestSeedCost(product: PipelineProduct): number | null {
  const targetName = cleanName(product.name);
  if (!targetName) return null;

  const targetTokens = new Set(tokenizeName(product.name));
  if (targetTokens.size === 0) return null;

  let bestScore = 0;
  let bestCost: number | null = null;

  for (const entry of seedCostEntries) {
    if (product.category && entry.category && product.category !== entry.category) {
      continue;
    }

    const entryTokens = entry.tokens;
    if (entryTokens.length === 0) continue;

    let overlap = 0;
    for (const token of entryTokens) {
      if (targetTokens.has(token)) overlap += 1;
    }

    const union = new Set<string>([...Array.from(targetTokens), ...entryTokens]).size;
    const jaccard = union > 0 ? overlap / union : 0;

    const substringBoost =
      entry.normalizedName.includes(targetName) || targetName.includes(entry.normalizedName)
        ? 0.15
        : 0;

    const score = jaccard + substringBoost;
    if (score > bestScore) {
      bestScore = score;
      bestCost = entry.costPrice;
    }
  }

  return bestScore >= 0.55 ? bestCost : null;
}

function loadSeedCostMap(): void {
  if (!fs.existsSync(SEED_FILE)) return;

  try {
    const raw = fs.readFileSync(SEED_FILE, "utf-8");
    const items = JSON.parse(raw) as PipelineProduct[];

    for (const item of items) {
      const key = cleanName(item.name);
      if (!key) continue;
      if (typeof item.costPrice === "number" && item.costPrice > 0) {
        seedCostByName.set(key, Number(item.costPrice.toFixed(2)));
        seedCostEntries.push({
          normalizedName: key,
          tokens: tokenizeName(item.name),
          costPrice: Number(item.costPrice.toFixed(2)),
          category: item.category,
        });
      }
    }
  } catch (err: any) {
    console.warn(`[SeedMap] Could not load seed costs: ${err.message}`);
  }
}

async function queryCJ(productName: string): Promise<number | null> {
  if (!CJ_API_KEY) return null;

  try {
    const response = await axios.get("https://api.cjdropshipping.com/api/product/search", {
      params: { name: productName },
      headers: {
        "CJ-Access-Token": CJ_API_KEY,
        // Keep compatibility with previous header style used in this codebase.
        "CJ5309554@api@20636d2a9ad24296a031aeeeadf0a33": CJ_API_KEY,
      },
      timeout: 15000,
    });

    const results = response.data?.data;
    if (!Array.isArray(results) || results.length === 0) return null;

    const first = results[0];
    const candidates = [first?.costPrice, first?.sellPrice, first?.price];

    for (const candidate of candidates) {
      const parsed = parseNumberLike(candidate);
      if (parsed !== null && parsed > 0) return parsed;
    }

    return null;
  } catch (err: any) {
    console.warn(`[CJ] Failed for \"${productName}\": ${err.message}`);
    return null;
  }
}

async function queryAliExpress(productName: string): Promise<number | null> {
  let browser: Browser | null = null;

  try {
    browser = await launchBrowserWithFallbacks();
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    const query = encodeURIComponent(productName);
    await page.goto(`https://www.aliexpress.com/wholesale?SearchText=${query}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const selectors = [
      ".price-current",
      ".mGXnE",
      "[class*='price']",
      "span[style*='color']",
    ];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 4000 });
        const text = await page.$eval(selector, (el: Element) => (el.textContent || "").trim());
        const match = text.match(/[\d,.]+/);
        if (!match) continue;
        const parsed = parseNumberLike(match[0]);
        if (parsed !== null && parsed > 0) return parsed;
      } catch {
        // Try the next selector.
      }
    }

    // Fallback parser for newer AliExpress markup where class names shift frequently.
    const fallbackPrice = await page.evaluate(() => {
      const candidates: number[] = [];
      const nodes = Array.from(document.querySelectorAll("[class*='price'], [data-pl='product-price'], span, div")).slice(0, 300);

      for (const node of nodes) {
        const text = (node.textContent || "").trim();
        if (!text) continue;
        // Capture values like 1,299.99 or 1299
        const matches = text.match(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g);
        if (!matches) continue;

        for (const raw of matches) {
          const value = Number(raw.replace(/,/g, ""));
          // Ignore tiny and absurd values.
          if (Number.isFinite(value) && value >= 1 && value <= 200000) {
            candidates.push(value);
          }
        }
      }

      if (candidates.length === 0) return null;
      // Prefer lower bound as proxy for supplier cost from listing prices.
      return Math.min(...candidates);
    });

    if (typeof fallbackPrice === "number" && Number.isFinite(fallbackPrice) && fallbackPrice > 0) {
      return fallbackPrice;
    }

    return null;
  } catch (err: any) {
    console.warn(`[AliExpress] Failed for \"${productName}\": ${err.message}`);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function launchBrowserWithFallbacks(): Promise<Browser> {
  const configuredExecutable = process.env.PUPPETEER_EXECUTABLE_PATH;

  const launchAttempts: Array<() => Promise<Browser>> = [
    () => puppeteer.launch({ headless: true }),
    () => puppeteer.launch({ headless: true, channel: "chrome" }),
  ];

  if (configuredExecutable && fs.existsSync(configuredExecutable)) {
    launchAttempts.unshift(() =>
      puppeteer.launch({
        headless: true,
        executablePath: configuredExecutable,
      })
    );
  }

  let lastError: any = null;

  for (const attempt of launchAttempts) {
    try {
      return await attempt();
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!warnedBrowserFallback) {
    warnedBrowserFallback = true;
    console.warn(
      "[AliExpress] Browser launch fallback exhausted. Set PUPPETEER_EXECUTABLE_PATH to your Chrome path if needed."
    );
  }

  throw lastError || new Error("Unable to launch browser for AliExpress scraping");
}

function estimateCost(currentPrice: number): number {
  return Number((currentPrice * (1 - THRESHOLD)).toFixed(2));
}

function isPlausibleExternalCost(cost: number, retailPrice: number): boolean {
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(retailPrice) || retailPrice <= 0) {
    return false;
  }

  const minAcceptable = retailPrice * 0.1;
  const maxAcceptable = retailPrice * 2;
  return cost >= minAcceptable && cost <= maxAcceptable;
}

export async function resolveCostPrice(product: PipelineProduct): Promise<{ costPrice: number; source: string }> {
  if (!FORCE && typeof product.costPrice === "number" && product.costPrice > 0) {
    return { costPrice: Number(product.costPrice.toFixed(2)), source: "existing" };
  }

  const queryName = cleanName(product.name);

  const knownSeedCost = seedCostByName.get(queryName);
  if (knownSeedCost && knownSeedCost > 0) {
    return { costPrice: knownSeedCost, source: "seed" };
  }

  const fuzzySeedCost = findClosestSeedCost(product);
  if (fuzzySeedCost && fuzzySeedCost > 0) {
    return { costPrice: Number(fuzzySeedCost.toFixed(2)), source: "seed-fuzzy" };
  }

  const cjPrice = await queryCJ(queryName);
  if (cjPrice !== null && isPlausibleExternalCost(cjPrice, product.price)) {
    return { costPrice: Number(cjPrice.toFixed(2)), source: "cj" };
  }

  const aliPrice = await queryAliExpress(queryName);
  if (aliPrice !== null && isPlausibleExternalCost(aliPrice, product.price)) {
    return { costPrice: Number(aliPrice.toFixed(2)), source: "aliexpress" };
  }

  return { costPrice: estimateCost(product.price), source: "estimated" };
}

export async function runJsonPipeline(): Promise<void> {
  const rawData = fs.readFileSync(SEED_FILE, "utf-8");
  const productsData = JSON.parse(rawData) as PipelineProduct[];

  const stats = { existing: 0, seed: 0, "seed-fuzzy": 0, cj: 0, aliexpress: 0, estimated: 0 };
  const scoped = LIMIT ? productsData.slice(0, LIMIT) : productsData;

  for (const product of scoped) {
    const { costPrice, source } = await resolveCostPrice(product);
    product.costPrice = costPrice;
    (stats as Record<string, number>)[source] += 1;
    console.log(`${product.name} -> M${costPrice} (${source})`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(productsData, null, 2), "utf-8");

  console.log("\nJSON pipeline completed.");
  console.log(`Updated file: ${OUTPUT_FILE}`);
  console.log(`Sources: existing=${stats.existing}, seed=${stats.seed}, seed-fuzzy=${stats["seed-fuzzy"]}, cj=${stats.cj}, aliexpress=${stats.aliexpress}, estimated=${stats.estimated}`);
}

export async function runDatabasePipeline(): Promise<void> {
  const whereClause = FORCE ? sql`true` : sql`${products.costPrice} <= 0`;

  const query = db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      costPrice: products.costPrice,
      category: products.category,
    })
    .from(products)
    .where(whereClause);

  const queriedRows = LIMIT && LIMIT > 0 ? await query.limit(LIMIT) : await query;
  const rows = TARGET_IDS.length > 0 ? queriedRows.filter((row) => TARGET_IDS.includes(row.id)) : queriedRows;

  if (rows.length === 0) {
    console.log("No products need cost price updates.");
    return;
  }

  const stats = { existing: 0, seed: 0, "seed-fuzzy": 0, cj: 0, aliexpress: 0, estimated: 0, updated: 0 };

  for (const row of rows) {
    const { costPrice, source } = await resolveCostPrice(row);

    await db
      .update(products)
      .set({ costPrice })
      .where(eq(products.id, row.id));

    (stats as Record<string, number>)[source] += 1;
    stats.updated += 1;
    console.log(`#${row.id} ${row.name} -> M${costPrice} (${source})`);
  }

  console.log("\nDatabase pipeline completed.");
  console.log(`Updated rows: ${stats.updated}`);
  console.log(`Sources: existing=${stats.existing}, seed=${stats.seed}, seed-fuzzy=${stats["seed-fuzzy"]}, cj=${stats.cj}, aliexpress=${stats.aliexpress}, estimated=${stats.estimated}`);
}

async function main(): Promise<void> {
  loadSeedCostMap();

  if (WRITE_DB) {
    await runDatabasePipeline();
    return;
  }

  await runJsonPipeline();
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});

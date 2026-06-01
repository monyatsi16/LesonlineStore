import puppeteer, { type Browser } from "puppeteer";
import fs from "fs";
import os from "os";
import path from "path";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "./db";
import { competitorPrices, competitorPriceHistory } from "../shared/schema";
import type { Product } from "../shared/schema";

const PRICE_MIN = 100;
const PRICE_MAX = 200_000;
const SCRAPE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NAV_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const MAX_MATCHES_PER_SITE = 8;
const SIMILARITY_THRESHOLD = 0.71;
const SCRAPING_ENABLED = process.env.COMPETITOR_SCRAPING !== "false";
const LOG_NO_COMPETITOR_DATA = process.env.COMPETITOR_LOG_NO_DATA === "true";
const GOOGLE_SHOPPING_NETWORK_COOLDOWN_MS = Number(process.env.COMPETITOR_GOOGLE_SHOPPING_COOLDOWN_MS ?? 10 * 60 * 1000);
const LOG_NETWORK_FALLBACK = process.env.COMPETITOR_LOG_NETWORK_FALLBACK === "true";

let googleShoppingBlockedUntil = 0;

type CompetitorSiteName = "takealot" | "game" | "makro" | "shoprite" | "okfurniture" | "incredibleconnection" | "hificorp";

export interface InternetSearchItem {
  source: CompetitorSiteName;
  title: string;
  price: number;
  url: string;
  relevance: number;
}

type RawCandidate = {
  title: string;
  url: string;
  price: number;
};

export interface CompetitorMatch {
  competitorName: string;
  productTitle: string;
  price: number;
  url: string;
  similarityScore: number;
}

export interface CompetitorPricesResponse {
  productId: number;
  query: string;
  source: "scraped" | "scraped-google";
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  matchCount: number;
  cached: boolean;
  matches: CompetitorMatch[];
}

export interface CompetitorPricingResult {
  avgCompetitorPrice: number;
  competitorDelta: number;
  source: "scraped" | "scraped-google";
}

export interface CompetitorPriceChange {
  id: number;
  productId: number;
  competitorName: string;
  productTitle: string;
  previousPrice: number;
  newPrice: number;
  percentChange: number;
  direction: "increased" | "decreased" | "stable";
  url: string | null;
  source: string;
  detectedAt: Date | null;
}

interface CompetitorPricingOptions {
  forceLiveScrape?: boolean;
  allowLiveScrape?: boolean;
}

const SEARCH_URLS: Record<CompetitorSiteName, (query: string) => string[]> = {
  takealot: (query) => [
    `https://www.takealot.com/all?qsearch=${query}`,
    `https://www.takealot.com/all?_sb=1&qsearch=${query}`,
  ],
  game: (query) => [
    `https://www.game.co.za/search/?text=${query}`,
    `https://www.game.co.za/search/?q=${query}`,
  ],
  makro: (query) => [
    `https://www.makro.co.za/search/?text=${query}`,
    `https://www.makro.co.za/search/?q=${query}`,
  ],
  shoprite: (query) => [
    `https://www.shoprite.co.za/search/all?q=${query}`,
    `https://www.shoprite.co.za/search/all?text=${query}`,
  ],
  // OK Furniture: live e-commerce site with real Lesotho/Southern Africa prices
  okfurniture: (query) => [
    `https://www.okfurniture.co.za/catalogsearch/result/?q=${query}`,
  ],
  // Incredible Connection: has physical store in Maseru, Pioneer Mall — Magento search
  incredibleconnection: (query) => [
    `https://www.incredible.co.za/catalogsearch/result/?q=${query}`,
  ],
  // HiFi Corp: appliances and electronics, ships to Lesotho
  hificorp: (query) => [
    `https://www.hificorp.co.za/catalogsearch/result/?q=${query}`,
  ],
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((token) => token.length > 1);
}

function extractBrand(product: Product): string {
  const specsBrand = typeof product.specs?.brand === "string" ? product.specs.brand : "";
  if (specsBrand.trim()) return specsBrand.trim();
  if (product.supplier?.trim()) return product.supplier.trim();

  const firstWord = product.name.split(" ")[0] || "";
  return firstWord.length > 2 ? firstWord : "";
}

function buildCompetitorSearchQuery(product: Product): string {
  const brand = extractBrand(product);
  const parts = [brand, product.name, product.category]
    .map((part) => normalize(part || ""))
    .filter(Boolean);

  const uniqueTerms = Array.from(new Set(parts.join(" ").split(" ").filter(Boolean)));
  return uniqueTerms.join(" ");
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  const aTokenList = Array.from(aTokens);
  const bTokenList = Array.from(bTokens);

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokenList) {
    if (bTokens.has(token)) intersection += 1;
  }

  const union = new Set([...aTokenList, ...bTokenList]).size;
  return union > 0 ? intersection / union : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateSimilarity(product: Product, title: string, query: string): number {
  const nameScore = tokenOverlapScore(product.name, title);
  const categoryScore = tokenOverlapScore(product.category, title);
  const keywordScore = tokenOverlapScore(query, title);

  const brand = extractBrand(product);
  const brandHit = brand && normalize(title).includes(normalize(brand)) ? 1 : 0;

  const score = (nameScore * 0.55) + (categoryScore * 0.2) + (keywordScore * 0.2) + (brandHit * 0.05);
  return clamp(score, 0, 1);
}

function toAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function removeOutliers(values: number[]): number[] {
  if (values.length <= 2) return values;
  const avg = toAverage(values);
  return values.filter((value) => value >= avg * 0.5 && value <= avg * 2);
}

function buildLaunchOptions(userDataDir?: string): Parameters<typeof puppeteer.launch>[0] {
  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  };

  if (userDataDir) {
    launchOptions.userDataDir = userDataDir;
  }

  if (process.platform === "win32") {
    launchOptions.channel = "chrome";
  }

  return launchOptions;
}

function createProfileDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lesonline-puppeteer-profile-"));
}

function cleanupProfileDir(userDataDir?: string): void {
  if (!userDataDir) return;
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures; temp files can be garbage-collected by OS.
  }
}

function isNetworkConnectivityError(error: unknown): boolean {
  const message = (error as Error | undefined)?.message?.toLowerCase() ?? "";
  return /err_internet_disconnected|err_name_not_resolved|err_network_changed|net::|econnrefused|enotfound|etimedout|socket hang up|network/.test(message);
}

function shouldSkipGoogleShoppingFallback(): boolean {
  return Date.now() < googleShoppingBlockedUntil;
}

function blockGoogleShoppingFallbackDueToNetwork(): void {
  googleShoppingBlockedUntil = Date.now() + GOOGLE_SHOPPING_NETWORK_COOLDOWN_MS;
}

async function launchBrowserWithIsolatedProfile(): Promise<{ browser: Browser; userDataDir: string }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const userDataDir = createProfileDir();
    const launchOptions = buildLaunchOptions(userDataDir);

    try {
      const browser = await puppeteer.launch(launchOptions);
      return { browser, userDataDir };
    } catch (error) {
      lastError = error;
      cleanupProfileDir(userDataDir);
      const message = (error as Error).message || "";
      const profileLockError = /already running|lockfile|ebusy/i.test(message);
      if (!profileLockError || attempt === 2) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function safeCloseBrowser(browser: Browser, userDataDir?: string): Promise<void> {
  try {
    await browser.close();
  } catch (error) {
    console.warn(`[CompetitorPricing] Browser close warning: ${(error as Error).message}`);
  } finally {
    cleanupProfileDir(userDataDir);
  }
}

async function safeClosePage(page: Awaited<ReturnType<Browser["newPage"]>>): Promise<void> {
  try {
    await page.close();
  } catch {
    // Ignore page-close errors caused by race conditions during browser shutdown.
  }
}

async function withRetry<T>(operation: () => Promise<T>, retries: number = MAX_RETRIES): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    }
  }

  throw lastError;
}

async function scrapePageCandidates(browser: Browser, url: string): Promise<RawCandidate[]> {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36"
    );

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      void (async () => {
        try {
          const type = req.resourceType();
          if (type === "image" || type === "font" || type === "stylesheet" || type === "media") {
            await req.abort();
          } else {
            await req.continue();
          }
        } catch {
          // Ignore request-interception races (already handled/canceled requests).
        }
      })();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

    const raw = (await page.evaluate(`(function() {
      var currencyRegex = /(?:R|M|ZAR|LSL)?\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)/gi;
      var anchors = Array.from(document.querySelectorAll("a[href]"));
      var candidates = [];

      function safeText(input) {
        return typeof input === "string" ? input.replace(/\\s+/g, " ").trim() : "";
      }

      for (var i = 0; i < anchors.length; i++) {
        var anchor = anchors[i];
        var href = (anchor.getAttribute("href") || "").trim();
        if (!href || href.startsWith("javascript:")) continue;

        var title = safeText(anchor.getAttribute("aria-label") || anchor.getAttribute("title") || anchor.textContent);
        if (title.length < 8 || title.length > 180) continue;

        var container = anchor.closest("article, li, div") || anchor.parentElement;
        var contextText = safeText(container ? container.textContent : "");
        var scanText = title + " " + contextText;

        currencyRegex.lastIndex = 0;
        var match = currencyRegex.exec(scanText);
        if (!match) continue;

        var normalized = match[1].replace(/\\s/g, "").replace(",", ".");
        var price = parseFloat(normalized);
        if (!isFinite(price)) continue;

        candidates.push({
          title: title,
          url: new URL(href, location.origin).href,
          price: price,
        });
      }

      return candidates;
    })()`) as Array<{ title: string; url: string; price: number }>);

    const deduped = new Map<string, RawCandidate>();
    for (const candidate of raw) {
      if (candidate.price < PRICE_MIN || candidate.price > PRICE_MAX) continue;

      const key = `${candidate.url}|${normalize(candidate.title)}`;
      if (!deduped.has(key)) {
        deduped.set(key, {
          title: candidate.title,
          url: candidate.url,
          price: candidate.price,
        });
      }
    }

    return Array.from(deduped.values());
  } finally {
    await safeClosePage(page);
  }
}

async function scrapeSiteMatches(
  browser: Browser,
  site: CompetitorSiteName,
  product: Product,
  query: string,
): Promise<CompetitorMatch[]> {
  const urls = SEARCH_URLS[site](encodeURIComponent(query));

  for (const url of urls) {
    try {
      const candidates = await withRetry(() => scrapePageCandidates(browser, url));

      const matches = candidates
        .map((candidate) => {
          const similarityScore = calculateSimilarity(product, candidate.title, query);
          return {
            competitorName: site,
            productTitle: candidate.title,
            price: candidate.price,
            url: candidate.url,
            similarityScore,
          };
        })
        .filter((candidate) => candidate.similarityScore > 0.7)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, MAX_MATCHES_PER_SITE);

      if (matches.length > 0) return matches;
    } catch {
      // Try next URL variant.
    }
  }

  return [];
}

async function scrapeLiveCompetitorMatches(product: Product, query: string): Promise<CompetitorMatch[]> {
  if (!SCRAPING_ENABLED) return [];

  const { browser, userDataDir } = await launchBrowserWithIsolatedProfile();

  try {
    const sites: CompetitorSiteName[] = ["takealot", "game", "makro", "shoprite", "okfurniture", "incredibleconnection", "hificorp"];
    const allMatches: CompetitorMatch[] = [];

    for (const site of sites) {
      const siteMatches = await scrapeSiteMatches(browser, site, product, query);
      allMatches.push(...siteMatches);
    }

    return allMatches;
  } finally {
    await safeCloseBrowser(browser, userDataDir);
  }
}

export async function searchInternetProducts(query: string, maxResults = 16): Promise<InternetSearchItem[]> {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const { browser, userDataDir } = await launchBrowserWithIsolatedProfile();

  try {
    const sites: CompetitorSiteName[] = ["takealot", "game", "makro", "shoprite", "okfurniture", "incredibleconnection", "hificorp"];
    const all: InternetSearchItem[] = [];

    for (const site of sites) {
      const urls = SEARCH_URLS[site](encodeURIComponent(query));

      for (const url of urls) {
        try {
          const candidates = await withRetry(() => scrapePageCandidates(browser, url));

          const mapped = candidates
            .map((candidate) => ({
              source: site,
              title: candidate.title,
              price: candidate.price,
              url: candidate.url,
              relevance: Number((tokenOverlapScore(query, candidate.title) * 100).toFixed(2)),
            }))
            .filter((item) => item.relevance >= 20)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 6);

          all.push(...mapped);

          if (mapped.length > 0) {
            break;
          }
        } catch {
          // Try next URL variant for this site.
        }
      }
    }

    const deduped = new Map<string, InternetSearchItem>();
    for (const item of all) {
      const key = `${normalize(item.title)}|${item.source}|${Math.round(item.price)}`;
      if (!deduped.has(key)) deduped.set(key, item);
    }

    return Array.from(deduped.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, Math.max(1, Math.min(40, maxResults)));
  } finally {
    await safeCloseBrowser(browser, userDataDir);
  }
}

function buildResponse(
  productId: number,
  query: string,
  source: "scraped" | "scraped-google",
  matches: CompetitorMatch[],
  cached: boolean,
): CompetitorPricesResponse {
  const prices = matches.map((match) => match.price);
  const cleaned = removeOutliers(prices);
  const cleanedAvg = cleaned.length > 0 ? toAverage(cleaned) : toAverage(prices);

  return {
    productId,
    query,
    source,
    averagePrice: Number((cleanedAvg || 0).toFixed(2)),
    minPrice: prices.length > 0 ? Math.min(...prices) : 0,
    maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
    matchCount: matches.length,
    cached,
    matches,
  };
}

function mapRowsToMatches(
  rows: Array<{
    competitorName: string | null;
    productTitle: string | null;
    price: number;
    url: string | null;
    similarityScore: number | null;
  }>,
): CompetitorMatch[] {
  return rows
    .filter((row) => !!row.competitorName && !!row.productTitle && !!row.url)
    .map((row) => ({
      competitorName: row.competitorName || "unknown",
      productTitle: row.productTitle || "unknown",
      price: row.price,
      url: row.url || "",
      similarityScore: row.similarityScore ?? 0,
    }));
}

async function getCachedRows(productId: number): Promise<{
  source: string;
  matches: CompetitorMatch[];
} | null> {
  const cutoff = new Date(Date.now() - SCRAPE_CACHE_TTL_MS);

  const rows = await db
    .select({
      source: competitorPrices.source,
      competitorName: competitorPrices.competitorName,
      productTitle: competitorPrices.productTitle,
      price: competitorPrices.price,
      url: competitorPrices.url,
      similarityScore: competitorPrices.similarityScore,
    })
    .from(competitorPrices)
    .where(and(eq(competitorPrices.productId, productId), gte(competitorPrices.timestamp, cutoff)))
    .orderBy(desc(competitorPrices.timestamp))
    .limit(60);

  if (rows.length === 0) return null;

  const matches = mapRowsToMatches(rows);
  if (matches.length === 0) return null;

  return {
    source: rows[0].source,
    matches,
  };
}

async function getLastKnownPrices(
  productId: number,
): Promise<Map<string, { price: number; url: string | null }>> {
  // For each competitor, get the most recent price we have recorded
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // look back 30 days
  const rows = await db
    .select({
      competitorName: competitorPrices.competitorName,
      price: competitorPrices.price,
      url: competitorPrices.url,
      timestamp: competitorPrices.timestamp,
    })
    .from(competitorPrices)
    .where(
      and(
        eq(competitorPrices.productId, productId),
        gte(competitorPrices.timestamp, cutoff),
      ),
    )
    .orderBy(desc(competitorPrices.timestamp))
    .limit(200);

  const latest = new Map<string, { price: number; url: string | null }>();
  for (const row of rows) {
    const name = row.competitorName ?? "unknown";
    if (!latest.has(name)) {
      latest.set(name, { price: row.price, url: row.url });
    }
  }
  return latest;
}

async function recordPriceChanges(
  productId: number,
  source: string,
  newMatches: CompetitorMatch[],
  previousPrices: Map<string, { price: number; url: string | null }>,
): Promise<void> {
  const changes: Array<{
    productId: number;
    competitorName: string;
    productTitle: string;
    previousPrice: number;
    newPrice: number;
    percentChange: number;
    direction: string;
    url: string | null;
    source: string;
    detectedAt: Date;
  }> = [];

  for (const match of newMatches) {
    const prev = previousPrices.get(match.competitorName);
    if (!prev) continue; // First time seeing this competitor — no change to record yet

    const prevPrice = prev.price;
    const newPrice = match.price;
    const diff = newPrice - prevPrice;

    // Only record if price actually moved by at least 0.5%
    if (Math.abs(diff) / prevPrice < 0.005) continue;

    const percentChange = Number(((diff / prevPrice) * 100).toFixed(2));
    const direction = diff > 0 ? "increased" : "decreased";

    changes.push({
      productId,
      competitorName: match.competitorName,
      productTitle: match.productTitle,
      previousPrice: prevPrice,
      newPrice,
      percentChange,
      direction,
      url: match.url || null,
      source,
      detectedAt: new Date(),
    });

    console.info(
      `[CompetitorPricing] ${match.competitorName} price ${direction} for "${match.productTitle}": ` +
      `M${prevPrice.toFixed(2)} → M${newPrice.toFixed(2)} (${percentChange > 0 ? "+" : ""}${percentChange}%)`,
    );
  }

  if (changes.length > 0) {
    await db.insert(competitorPriceHistory).values(changes);
  }
}

async function persistMatches(
  productId: number,
  source: string,
  matches: CompetitorMatch[],
): Promise<void> {
  if (matches.length === 0) return;

  const previousPrices = await getLastKnownPrices(productId);
  await recordPriceChanges(productId, source, matches, previousPrices);

  await db.insert(competitorPrices).values(
    matches.map((match) => ({
      productId,
      competitorName: match.competitorName,
      productTitle: match.productTitle,
      price: match.price,
      url: match.url,
      similarityScore: match.similarityScore,
      source,
      timestamp: new Date(),
    })),
  );
}

async function scrapeGoogleShopping(product: Product, query: string): Promise<CompetitorMatch[]> {
  if (!SCRAPING_ENABLED) return [];

  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encodedQuery}&tbm=shop`;
  const { browser, userDataDir } = await launchBrowserWithIsolatedProfile();

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      void (async () => {
        try {
          const type = req.resourceType();
          if (type === "image" || type === "font" || type === "stylesheet" || type === "media") {
            await req.abort();
          } else {
            await req.continue();
          }
        } catch {
          // Ignore request-interception races (already handled/canceled requests).
        }
      })();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

    const candidates = await page.evaluate(`(function() {
      const results = [];

      const containers = document.querySelectorAll(
        ".sh-dgr__content, .sh-pr__product-result, [data-docid], .mnr-c"
      );

      const currencyRegex = /(?:R|M|ZAR|LSL)?\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)/i;

      for (const item of Array.from(containers)) {
        const titleEl = item.querySelector("h3, .tAxDx, .EI11Pd, [aria-label]");
        const priceEl = item.querySelector(".a8Pemb, .OFFNJ, [class*='price'], [class*='Price']");
        const sellerEl = item.querySelector(".aULzUe, .ql6J9c, [class*='merchant'], [class*='seller']");
        const linkEl = item.querySelector("a[href]");

        if (!titleEl || !priceEl) continue;

        const title = (titleEl.textContent || "").replace(/\\s+/g, " ").trim();
        const rawPrice = (priceEl.textContent || "").replace(/\\s+/g, " ").trim();
        const match = currencyRegex.exec(rawPrice);
        if (!match) continue;

        const price = parseFloat(match[1].replace(/\\s/g, "").replace(",", "."));
        if (!title || !isFinite(price) || price <= 0) continue;

        const sellerText = sellerEl && sellerEl.textContent ? sellerEl.textContent : "";
        const seller = sellerText.replace(/\\s+/g, " ").trim() || "google-shopping";
        const href = linkEl ? (linkEl.getAttribute("href") || "") : "";

        results.push({ title, price, seller, href });
      }

      return results;
    }).call(this)`);  

    await safeClosePage(page);

    const typedCandidates = (candidates as Array<{ title: string; price: number; seller: string; href: string }>);

    return typedCandidates
      .filter((c) => c.price >= PRICE_MIN && c.price <= PRICE_MAX)
      .map((c) => ({
        competitorName: c.seller.slice(0, 60),
        productTitle: c.title,
        price: c.price,
        url: c.href,
        similarityScore: calculateSimilarity(product, c.title, query),
      }))
      .filter((c) => c.similarityScore >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, MAX_MATCHES_PER_SITE * 2);
  } finally {
    await safeCloseBrowser(browser, userDataDir);
  }
}

export async function getCompetitorPrices(
  product: Product,
  options: CompetitorPricingOptions = {},
): Promise<CompetitorPricesResponse> {
  const query = buildCompetitorSearchQuery(product);
  const allowLiveScrape = options.allowLiveScrape ?? true;

  // --- Tier 0: Cache (6 h TTL) ---
  if (!options.forceLiveScrape) {
    const cached = await getCachedRows(product.id);
    if (cached && cached.matches.length > 0) {
      const src = cached.source === "scraped-google"
        ? "scraped-google"
        : "scraped";
      return buildResponse(product.id, query, src, cached.matches, true);
    }
  }

  // --- Tier 1: Live scrape from Takealot / Game / Makro / Shoprite ---
  if (allowLiveScrape) {
    try {
      const liveMatches = await scrapeLiveCompetitorMatches(product, query);
      if (liveMatches.length > 0) {
        await persistMatches(product.id, "scraped", liveMatches);
        return buildResponse(product.id, query, "scraped", liveMatches, false);
      }
    } catch (error) {
      const message = (error as Error).message ?? "Unknown scraping error";
      const missingChrome = /could not find chrome|could not find expected browser/i.test(message);
      if (missingChrome) {
        console.warn("[CompetitorPricing] Chrome not found for Puppeteer; trying Google Shopping fallback.");
      } else {
        console.warn(`[CompetitorPricing] Live scrape failed for "${product.name}": ${message}`);
      }
    }

    // --- Tier 2: Google Shopping fallback (real prices from web) ---
    if (!shouldSkipGoogleShoppingFallback()) {
      try {
        const googleMatches = await scrapeGoogleShopping(product, query);
        if (googleMatches.length > 0) {
          await persistMatches(product.id, "scraped-google", googleMatches);
          return buildResponse(product.id, query, "scraped-google", googleMatches, false);
        }
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          blockGoogleShoppingFallbackDueToNetwork();
          if (LOG_NETWORK_FALLBACK) {
            console.warn("[CompetitorPricing] Network unavailable; temporarily skipping Google Shopping fallback.");
          }
        } else {
          console.warn(`[CompetitorPricing] Google Shopping scrape failed for "${product.name}": ${(error as Error).message}`);
        }
      }
    }
  }

  // No real data available from any live source. Keep this silent unless explicitly enabled.
  if (LOG_NO_COMPETITOR_DATA) {
    console.warn(`[CompetitorPricing] No competitor data found for "${product.name}" (${product.category}) from any live source.`);
  }
  return buildResponse(product.id, query, "scraped", [], false);
}

export async function getRecentCompetitorPriceChanges(
  productId: number,
  limitDays = 7,
): Promise<CompetitorPriceChange[]> {
  const cutoff = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(competitorPriceHistory)
    .where(
      and(
        eq(competitorPriceHistory.productId, productId),
        gte(competitorPriceHistory.detectedAt, cutoff),
      ),
    )
    .orderBy(desc(competitorPriceHistory.detectedAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    competitorName: r.competitorName,
    productTitle: r.productTitle,
    previousPrice: r.previousPrice,
    newPrice: r.newPrice,
    percentChange: r.percentChange,
    direction: r.direction as "increased" | "decreased" | "stable",
    url: r.url,
    source: r.source,
    detectedAt: r.detectedAt,
  }));
}

export async function getAllRecentPriceChanges(limitDays = 7): Promise<CompetitorPriceChange[]> {
  const cutoff = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(competitorPriceHistory)
    .where(gte(competitorPriceHistory.detectedAt, cutoff))
    .orderBy(desc(competitorPriceHistory.detectedAt))
    .limit(500);

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    competitorName: r.competitorName,
    productTitle: r.productTitle,
    previousPrice: r.previousPrice,
    newPrice: r.newPrice,
    percentChange: r.percentChange,
    direction: r.direction as "increased" | "decreased" | "stable",
    url: r.url,
    source: r.source,
    detectedAt: r.detectedAt,
  }));
}

export async function getCompetitorPricing(
  product: Product,
  options: CompetitorPricingOptions = {},
): Promise<CompetitorPricingResult> {
  const result = await getCompetitorPrices(product, options);

  return {
    avgCompetitorPrice: result.averagePrice,
    competitorDelta: product.price - result.averagePrice,
    source: result.source === "scraped-google" ? "scraped-google" : "scraped",
  };
}

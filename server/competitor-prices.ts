/**
 * Lesotho Competitor Price Catalogue — FALLBACK ONLY
 *
 * Used ONLY when live scraping fails for all sites.
 * Prices are in Maloti (M) and were estimated manually — they are NOT live.
 *
 * Scraping status per store:
 *  - OK Furniture (okfurniture.co.za)  ✅ Live-scraped via Puppeteer (tier 1)
 *  - Lewis (lewis.co.za)               ❌ Website offline — hardcoded fallback only
 *  - Bears (bears.co.za)               ❌ No working website — hardcoded fallback only
 *
 * Maintenance:
 *  - Only update Lewis/Bears entries here; OK Furniture prices come from the web.
 *  - Keys are normalised product names (lowercase, alphanumeric + spaces).
 */

export interface CompetitorEntry {
  okFurniture?: number;
  lewis?: number;
  bears?: number;
  /** Any other local competitor → price mapping */
  [storeName: string]: number | undefined;
}

/** Catalogue keyed by normalised product name */
const COMPETITOR_CATALOGUE: Record<string, CompetitorEntry> = {
  // ── Sofas & Couches ───────────────────────────────────────────────────────
  "3 seater sofa":            { okFurniture: 4999,  lewis: 5499,  bears: 4799 },
  "2 seater sofa":            { okFurniture: 3499,  lewis: 3899,  bears: 3299 },
  "l shape sofa":             { okFurniture: 7999,  lewis: 8499,  bears: 7499 },
  "corner sofa":              { okFurniture: 8499,  lewis: 9299,  bears: 7999 },
  "recliner sofa":            { okFurniture: 6999,  lewis: 7499,  bears: 6499 },
  "sleeper couch":            { okFurniture: 5499,  lewis: 5999,  bears: 4999 },
  "fabric sofa set":          { okFurniture: 9999,  lewis: 10999, bears: 9499 },
  "leather sofa set":         { okFurniture: 12999, lewis: 14999, bears: 11999 },

  // ── Bedroom Furniture ─────────────────────────────────────────────────────
  "queen bed":                { okFurniture: 3999,  lewis: 4499,  bears: 3799 },
  "king bed":                 { okFurniture: 5999,  lewis: 6499,  bears: 5499 },
  "single bed":               { okFurniture: 1999,  lewis: 2299,  bears: 1899 },
  "double bed":               { okFurniture: 2999,  lewis: 3299,  bears: 2799 },
  "bed frame":                { okFurniture: 2499,  lewis: 2799,  bears: 2299 },
  "headboard":                { okFurniture: 999,   lewis: 1199,  bears: 899  },
  "wardrobe":                 { okFurniture: 5499,  lewis: 6299,  bears: 5199 },
  "2 door wardrobe":          { okFurniture: 4499,  lewis: 4999,  bears: 4199 },
  "3 door wardrobe":          { okFurniture: 5999,  lewis: 6499,  bears: 5499 },
  "chest of drawers":         { okFurniture: 2999,  lewis: 3299,  bears: 2699 },
  "bedside table":            { okFurniture: 899,   lewis: 999,   bears: 799  },
  "dressing table":           { okFurniture: 2499,  lewis: 2799,  bears: 2299 },
  "bedroom suite":            { okFurniture: 11999, lewis: 13999, bears: 10999 },
  "mattress":                 { okFurniture: 2499,  lewis: 2999,  bears: 2199 },
  "queen mattress":           { okFurniture: 3499,  lewis: 3999,  bears: 3199 },
  "king mattress":            { okFurniture: 4499,  lewis: 4999,  bears: 3999 },

  // ── Dining Room ───────────────────────────────────────────────────────────
  "dining table":             { okFurniture: 3499,  lewis: 3999,  bears: 3199 },
  "4 seater dining set":      { okFurniture: 4999,  lewis: 5499,  bears: 4699 },
  "6 seater dining set":      { okFurniture: 6999,  lewis: 7499,  bears: 6499 },
  "dining chair":             { okFurniture: 699,   lewis: 799,   bears: 649  },
  "bar stool":                { okFurniture: 799,   lewis: 899,   bears: 749  },
  "bar counter":              { okFurniture: 4999,  lewis: 5499,  bears: 4499 },

  // ── Living Room / Entertainment ───────────────────────────────────────────
  "tv stand":                 { okFurniture: 1999,  lewis: 2299,  bears: 1799 },
  "entertainment unit":       { okFurniture: 3499,  lewis: 3999,  bears: 3199 },
  "coffee table":             { okFurniture: 1499,  lewis: 1699,  bears: 1299 },
  "side table":               { okFurniture: 799,   lewis: 899,   bears: 699  },
  "bookshelf":                { okFurniture: 1699,  lewis: 1999,  bears: 1499 },
  "display cabinet":          { okFurniture: 3999,  lewis: 4499,  bears: 3699 },

  // ── Home Appliances ───────────────────────────────────────────────────────
  "fridge":                   { okFurniture: 5999,  lewis: 6499,  bears: 5499 },
  "double door fridge":       { okFurniture: 9999,  lewis: 10999, bears: 8999 },
  "washing machine":          { okFurniture: 5499,  lewis: 5999,  bears: 4999 },
  "tumble dryer":             { okFurniture: 4999,  lewis: 5499,  bears: 4499 },
  "stove":                    { okFurniture: 4999,  lewis: 5499,  bears: 4499 },
  "microwave":                { okFurniture: 1499,  lewis: 1699,  bears: 1299 },
  "dishwasher":               { okFurniture: 6999,  lewis: 7499,  bears: 6499 },
  "television":               { okFurniture: 4999,  lewis: 5499,  bears: 4499 },
  "43 inch tv":               { okFurniture: 4999,  lewis: 5499,  bears: 4499 },
  "55 inch tv":               { okFurniture: 7999,  lewis: 8499,  bears: 7499 },
  "65 inch tv":               { okFurniture: 10999, lewis: 11999, bears: 9999 },

  // ── Office & Study ────────────────────────────────────────────────────────
  "office desk":              { okFurniture: 2499,  lewis: 2799,  bears: 2199 },
  "office chair":             { okFurniture: 1999,  lewis: 2299,  bears: 1799 },
  "computer desk":            { okFurniture: 1999,  lewis: 2299,  bears: 1799 },
  "study desk":               { okFurniture: 1499,  lewis: 1699,  bears: 1299 },

  // ── Kids ──────────────────────────────────────────────────────────────────
  "bunk bed":                 { okFurniture: 4499,  lewis: 4999,  bears: 3999 },
  "kids bed":                 { okFurniture: 1999,  lewis: 2299,  bears: 1799 },
  "kids wardrobe":            { okFurniture: 2999,  lewis: 3299,  bears: 2699 },
};

/** Normalise a product name the same way pricing-model.ts does */
function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim();
}

export interface CompetitorPriceSummary {
  /** Average price across all competitors that list this product */
  avgCompetitorPrice: number;
  /** Lowest competitor price */
  minCompetitorPrice: number;
  /** Highest competitor price */
  maxCompetitorPrice: number;
  /** How many stores list this product */
  sourceCount: number;
  /** Per-store breakdown */
  breakdown: Record<string, number>;
}

/**
 * Look up competitor prices for a product by name.
 * Falls back to category-level average if no exact match exists.
 * Returns null when no competitor data is available at all.
 */
export function getCompetitorPrices(
  productName: string,
  _category?: string,
): CompetitorPriceSummary | null {
  const key = normaliseName(productName);
  const entry = COMPETITOR_CATALOGUE[key];

  if (!entry) {
    // Try a partial / substring match
    const partial = Object.keys(COMPETITOR_CATALOGUE).find(
      (k) => k.includes(key) || key.includes(k),
    );
    if (!partial) return null;
    return summarise(COMPETITOR_CATALOGUE[partial]);
  }

  return summarise(entry);
}

function summarise(entry: CompetitorEntry): CompetitorPriceSummary {
  const prices = Object.entries(entry)
    .filter(([ , v]) => typeof v === "number" && v > 0) as [string, number][];

  if (prices.length === 0) return {
    avgCompetitorPrice: 0, minCompetitorPrice: 0,
    maxCompetitorPrice: 0, sourceCount: 0, breakdown: {},
  };

  const values = prices.map(([, v]) => v);
  const breakdown: Record<string, number> = Object.fromEntries(prices);

  return {
    avgCompetitorPrice: values.reduce((a, b) => a + b, 0) / values.length,
    minCompetitorPrice: Math.min(...values),
    maxCompetitorPrice: Math.max(...values),
    sourceCount: values.length,
    breakdown,
  };
}

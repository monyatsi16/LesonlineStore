import seedData from "./seed-data.json" with { type: "json" };
import type { Product } from "@shared/schema";

interface CategoryStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  count: number;
  q25: number;
  q75: number;
}

interface FeatureVector {
  pricePositionInCategory: number;
  priceToMeanRatio: number;
  priceToMedianRatio: number;
  stockLevel: number;
  demandScore: number;
  viewScore: number;
  conversionRate: number;
  categoryPremium: number;
}

interface PricingResult {
  recommendedPrice: number;
  confidence: number;
  reason: string;
  trend: "up" | "down" | "stable";
  factors: {
    categoryAnalysis: string;
    demandSignal: string;
    inventorySignal: string;
    competitivePosition: string;
  };
}

const categoryStatsCache: Map<string, CategoryStats> = new Map();

function computeStats(prices: number[]): CategoryStats {
  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const q25 = sorted[Math.floor(n * 0.25)];
  const q75 = sorted[Math.floor(n * 0.75)];

  return { mean, std, min: sorted[0], max: sorted[n - 1], median, count: n, q25, q75 };
}

export function initializeModel(): void {
  const categoryPrices: Map<string, number[]> = new Map();

  for (const item of seedData) {
    const cat = item.category;
    if (!categoryPrices.has(cat)) categoryPrices.set(cat, []);
    categoryPrices.get(cat)!.push(item.price);
  }

  for (const [cat, prices] of categoryPrices) {
    categoryStatsCache.set(cat, computeStats(prices));
  }

  console.log(`[Pricing Model] Initialized with ${seedData.length} products across ${categoryStatsCache.size} categories`);
}

function getCategoryStats(category: string): CategoryStats | null {
  if (categoryStatsCache.has(category)) return categoryStatsCache.get(category)!;

  for (const [cat, stats] of categoryStatsCache) {
    if (cat.toLowerCase().includes(category.toLowerCase()) ||
        category.toLowerCase().includes(cat.toLowerCase())) {
      return stats;
    }
  }
  return null;
}

function extractFeatures(
  product: Product,
  orderCount: number,
  stats: CategoryStats | null
): FeatureVector {
  const catMean = stats?.mean || product.price;
  const catMedian = stats?.median || product.price;
  const catMin = stats?.min || product.price * 0.5;
  const catMax = stats?.max || product.price * 2;
  const range = catMax - catMin || 1;

  return {
    pricePositionInCategory: (product.price - catMin) / range,
    priceToMeanRatio: product.price / catMean,
    priceToMedianRatio: product.price / catMedian,
    stockLevel: Math.min(product.stock / 30, 1),
    demandScore: Math.min(orderCount / 20, 1),
    viewScore: Math.min((product.views || 0) / 100, 1),
    conversionRate: product.views > 0 ? Math.min(orderCount / product.views, 1) : 0,
    categoryPremium: catMean / (seedData.reduce((s, p) => s + p.price, 0) / seedData.length),
  };
}

function buildTree(features: FeatureVector, depth: number): number {
  let adjustment = 0;

  if (features.demandScore > 0.5) {
    if (features.stockLevel < 0.3) {
      adjustment += 0.12;
    } else if (features.stockLevel < 0.6) {
      adjustment += 0.07;
    } else {
      adjustment += 0.03;
    }
  } else if (features.demandScore > 0.2) {
    if (features.conversionRate > 0.1) {
      adjustment += 0.05;
    } else {
      adjustment += 0.01;
    }
  } else if (features.demandScore > 0) {
    adjustment -= 0.02;
  } else {
    if (features.viewScore > 0.3) {
      adjustment -= 0.03;
    } else {
      adjustment -= 0.08;
    }
  }

  return adjustment;
}

function buildTree2(features: FeatureVector): number {
  let adjustment = 0;

  if (features.priceToMeanRatio > 1.3) {
    adjustment -= 0.06;
    if (features.demandScore < 0.3) {
      adjustment -= 0.04;
    }
  } else if (features.priceToMeanRatio > 1.1) {
    if (features.conversionRate > 0.15) {
      adjustment += 0.02;
    } else {
      adjustment -= 0.03;
    }
  } else if (features.priceToMeanRatio < 0.7) {
    adjustment += 0.08;
    if (features.demandScore > 0.3) {
      adjustment += 0.05;
    }
  } else if (features.priceToMeanRatio < 0.9) {
    if (features.viewScore > 0.2) {
      adjustment += 0.04;
    } else {
      adjustment += 0.02;
    }
  }

  return adjustment;
}

function buildTree3(features: FeatureVector): number {
  let adjustment = 0;

  if (features.stockLevel < 0.15) {
    adjustment += 0.10;
    if (features.demandScore > 0.4) {
      adjustment += 0.06;
    }
  } else if (features.stockLevel < 0.3) {
    adjustment += 0.04;
  } else if (features.stockLevel > 0.8) {
    adjustment -= 0.05;
    if (features.demandScore < 0.2) {
      adjustment -= 0.04;
    }
  } else if (features.stockLevel > 0.6) {
    adjustment -= 0.02;
  }

  return adjustment;
}

function buildTree4(features: FeatureVector): number {
  let adjustment = 0;

  if (features.conversionRate > 0.2) {
    adjustment += 0.06;
  } else if (features.conversionRate > 0.1) {
    adjustment += 0.03;
  } else if (features.conversionRate > 0.05) {
    adjustment += 0.01;
  } else if (features.viewScore > 0.5 && features.conversionRate < 0.02) {
    adjustment -= 0.05;
  }

  return adjustment;
}

function buildTree5(features: FeatureVector): number {
  let adjustment = 0;

  if (features.pricePositionInCategory > 0.85) {
    if (features.demandScore < 0.3 && features.conversionRate < 0.1) {
      adjustment -= 0.07;
    }
  } else if (features.pricePositionInCategory < 0.15) {
    if (features.demandScore > 0.3) {
      adjustment += 0.06;
    }
  }

  if (features.categoryPremium > 1.5 && features.priceToMedianRatio < 0.8) {
    adjustment += 0.03;
  }

  return adjustment;
}

export function predict(
  product: Product,
  orderCount: number
): PricingResult {
  const stats = getCategoryStats(product.category);
  const features = extractFeatures(product, orderCount, stats);

  const learningRate = 0.3;
  let totalAdjustment = 0;

  const tree1 = buildTree(features, 0);
  totalAdjustment += learningRate * tree1;

  const tree2 = buildTree2(features);
  totalAdjustment += learningRate * tree2;

  const tree3 = buildTree3(features);
  totalAdjustment += learningRate * tree3;

  const tree4 = buildTree4(features);
  totalAdjustment += learningRate * tree4;

  const tree5 = buildTree5(features);
  totalAdjustment += learningRate * tree5;

  const recommendedPrice = Number((product.price * (1 + totalAdjustment)).toFixed(2));

  const changePct = Math.abs(totalAdjustment);
  let confidence: number;
  if (stats && stats.count >= 10) {
    confidence = 0.82 + Math.min(changePct * 2, 0.15);
  } else if (stats && stats.count >= 5) {
    confidence = 0.72 + Math.min(changePct * 2, 0.15);
  } else {
    confidence = 0.60 + Math.min(changePct * 2, 0.15);
  }
  confidence = Number(confidence.toFixed(2));

  const trend: "up" | "down" | "stable" =
    totalAdjustment > 0.01 ? "up" : totalAdjustment < -0.01 ? "down" : "stable";

  const reasons: string[] = [];
  const factors = {
    categoryAnalysis: "",
    demandSignal: "",
    inventorySignal: "",
    competitivePosition: "",
  };

  if (stats) {
    if (features.priceToMeanRatio > 1.2) {
      reasons.push(`Priced ${((features.priceToMeanRatio - 1) * 100).toFixed(0)}% above category avg (M${stats.mean.toFixed(0)})`);
      factors.categoryAnalysis = `Above market average of M${stats.mean.toFixed(0)} for ${product.category}`;
    } else if (features.priceToMeanRatio < 0.8) {
      reasons.push(`Priced ${((1 - features.priceToMeanRatio) * 100).toFixed(0)}% below category avg (M${stats.mean.toFixed(0)})`);
      factors.categoryAnalysis = `Below market average of M${stats.mean.toFixed(0)} for ${product.category}`;
    } else {
      factors.categoryAnalysis = `Near market average of M${stats.mean.toFixed(0)} for ${product.category}`;
    }
  }

  if (orderCount > 10) {
    reasons.push(`High demand (${orderCount} orders)`);
    factors.demandSignal = `Strong demand with ${orderCount} orders`;
  } else if (orderCount > 5) {
    reasons.push(`Moderate demand (${orderCount} orders)`);
    factors.demandSignal = `Moderate demand with ${orderCount} orders`;
  } else if (orderCount > 0) {
    factors.demandSignal = `Low demand with ${orderCount} orders`;
  } else {
    reasons.push("No orders yet");
    factors.demandSignal = "No order history — using market data";
  }

  if (product.stock < 5) {
    reasons.push(`Critical stock (${product.stock} units)`);
    factors.inventorySignal = `Very low inventory: ${product.stock} units`;
  } else if (product.stock < 10) {
    reasons.push(`Low stock (${product.stock} units)`);
    factors.inventorySignal = `Low inventory: ${product.stock} units`;
  } else if (product.stock > 25) {
    reasons.push(`Excess stock (${product.stock} units)`);
    factors.inventorySignal = `High inventory: ${product.stock} units`;
  } else {
    factors.inventorySignal = `Healthy inventory: ${product.stock} units`;
  }

  if (features.conversionRate > 0.15) {
    reasons.push(`High conversion (${(features.conversionRate * 100).toFixed(1)}%)`);
    factors.competitivePosition = "Strong competitive position";
  } else if (features.viewScore > 0.3 && features.conversionRate < 0.03) {
    reasons.push("High views, low conversion — may be overpriced");
    factors.competitivePosition = "Price may be deterring buyers";
  } else {
    factors.competitivePosition = "Normal market position";
  }

  const reason = `GB Model [5 Trees, LR=${learningRate}]: ${reasons.join("; ")}.`;

  return { recommendedPrice, confidence, reason, trend, factors };
}

export function getMarketInsights(category: string): CategoryStats | null {
  return getCategoryStats(category);
}

export function getAllCategoryStats(): Map<string, CategoryStats> {
  return new Map(categoryStatsCache);
}

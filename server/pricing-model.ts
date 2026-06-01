
import { db } from "./db";
import { products, orders, priceRecommendations } from "../shared/schema";
import { sql } from "drizzle-orm";
import type { Product } from "../shared/schema";
import { XGBModel } from "@wlearn/xgboost";
import fs from "fs";
import path from "path";
import { getCompetitorPrices as getLiveCompetitorPrices } from "./competitor-pricing";

const SEED_DATASET_PATH = path.join(process.cwd(), "server", "seed-data.json");
const DATASET_MIN_RATIO = 0.85;

function normalizeProductName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim();
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, idx) => idx);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices;
}

function subsetByIndices<T>(values: T[], indices: number[]): T[] {
  return indices.map((idx) => values[idx]);
}

function createDataSplits(totalCount: number): { trainIdx: number[]; valIdx: number[]; testIdx: number[] } {
  const indices = shuffleIndices(totalCount);

  if (totalCount < 12) {
    const trainEnd = Math.max(1, Math.floor(totalCount * 0.8));
    return {
      trainIdx: indices.slice(0, trainEnd),
      valIdx: [],
      testIdx: indices.slice(trainEnd),
    };
  }

  const trainEnd = Math.max(1, Math.floor(totalCount * 0.7));
  const valEnd = Math.max(trainEnd + 1, Math.floor(totalCount * 0.85));

  return {
    trainIdx: indices.slice(0, trainEnd),
    valIdx: indices.slice(trainEnd, valEnd),
    testIdx: indices.slice(valEnd),
  };
}

interface ProductMetrics {
  product: Product;
  orderCount: number;
  views: number;
  conversionRate: number;
  avgOrderValue: number;
  daysOnMarket: number;
  stockVelocity: number;
  orders7d: number;       // real order count last 7 days
  orders30d: number;      // real order count last 30 days
  avgUnitPrice: number;   // revenue-weighted average sale price (0 if no orders)
}

interface TrainingData {
  features: number[][];
  labels: number[];
  productIds: number[];
}

export interface PricingResult {
  productId: number;
  productName: string;
  currentPrice: number;
  recommendedPrice: number;
  confidence: number;
  reason: string;
  trend: "up" | "down" | "stable";
  modelVersion: string;
  factors: {
    demandScore: number;
    competitorScore: number;
    stockScore: number;
    categoryScore: number;
    marginScore: number;
  };
}

export interface CategoryStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  count: number;
  q25: number;
  q75: number;
}

export interface ModelInfo {
  version: string;
  lastTrained: Date;
  trainingDataSize: number;
  features: string[];
  hyperparameters: Record<string, any>;
  performance: {
    mse: number;
    rmse: number;
    mae: number;
    r2: number;
    crossValidationScore: number;
  };
  featureImportance: Record<string, number>;
  trainingHistory: Array<{
    timestamp: Date;
    duration: number;
    finalLoss: number;
    iterations: number;
  }>;
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

/** Fetches and caches product metrics from the database*/
class MetricsFetcher {
  public categoryStatsCache: Map<string, CategoryStats> = new Map();
  private lastCacheTTL: number = Date.now();
  private cacheTTL: number = 3600000; // 1 hour

  async initialize(): Promise<void> {
    await this.refreshCategoryStats();
  }

  async refreshCategoryStats(): Promise<void> {
    const categories = await db.selectDistinct({ category: products.category }).from(products);

    for (const { category } of categories) {
      const categoryProducts = await db
        .select({ price: products.price })
        .from(products)
        .where(sql`${products.category} = ${category}`);

      if (categoryProducts.length > 0) {
        const prices = categoryProducts.map((p) => p.price);
        this.categoryStatsCache.set(category, this.computeStats(prices));
      }
    }

    this.lastCacheTTL = Date.now();
  }

  private computeStats(prices: number[]): CategoryStats {
    const sorted = [...prices].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = prices.reduce((a, b) => a + b, 0) / n;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / n;
    const std = Math.sqrt(variance);

    return {
      mean,
      std,
      min: sorted[0],
      max: sorted[n - 1],
      median: n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)],
      count: n,
      q25: sorted[Math.floor(n * 0.25)],
      q75: sorted[Math.floor(n * 0.75)],
    };
  }

  getCategoryStats(category: string): CategoryStats | null {
    if (Date.now() - this.lastCacheTTL > this.cacheTTL) {
      this.refreshCategoryStats();
    }
    return this.categoryStatsCache.get(category) || null;
  }

  async getProductMetrics(product: Product): Promise<ProductMetrics> {
    // Get orders for this product
    const orderData = await db
      .select({
        orderCount: sql<number>`count(*)`,
        totalRevenue: sql<number>`sum(${orders.totalPrice})`,
        weightedUnitSum: sql<number>`sum(${orders.unitPrice} * ${orders.quantity})`,
        totalQty: sql<number>`sum(${orders.quantity})`,
      })
      .from(orders)
      .where(sql`${orders.productId} = ${product.id}`);

    const orderCount = Number(orderData[0]?.orderCount) || 0;
    const avgOrderValue = orderData[0]?.totalRevenue
      ? (orderData[0].totalRevenue as number) / (orderCount || 1)
      : product.price;
    const totalQty = Number(orderData[0]?.totalQty) || 0;
    const weightedUnitSum = Number(orderData[0]?.weightedUnitSum) || 0;
    const avgUnitPrice = totalQty > 0 ? weightedUnitSum / totalQty : 0;

    // Real 7-day order count
    const orders7dData = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.productId} = ${product.id} AND ${orders.createdAt} >= NOW() - INTERVAL '7 days'`);
    const orders7d = Number(orders7dData[0]?.count) || 0;

    // Real 30-day order count
    const orders30dData = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.productId} = ${product.id} AND ${orders.createdAt} >= NOW() - INTERVAL '30 days'`);
    const orders30d = Number(orders30dData[0]?.count) || 0;

    // Calculate days on market
    const daysOnMarket = product.createdAt
      ? Math.floor((Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const views = product.views || 0;
    const conversionRate = views > 0 ? orderCount / views : 0;
    const stockVelocity = daysOnMarket > 0 ? orderCount / daysOnMarket : 0;

    return {
      product,
      orderCount,
      views,
      conversionRate,
      avgOrderValue,
      daysOnMarket,
      stockVelocity,
      orders7d,
      orders30d,
      avgUnitPrice,
    };
  }
}

/** Feature Engineering Pipeline */
class FeatureEngine {
  private metricsFetcher: MetricsFetcher;
  private featureNames: string[] = [
    "orderCount",
    "views",
    "conversionRate",
    "priceZScore",
    "pricePercentile",
    "stock",
    "stockVelocity",
    "daysOnMarket",
    "categoryVelocity",
    "marginPercent",
    "costRatio",
    "moqPenalty",
    "priceRange",
    "competitorDelta",
    "seasonalFactor",
    "demandElasticity",
    "categoryDemandIndex",
    "priceVolatility",
    "competitorPrice",
    "customerSegment",
    "promotionHistory",
    "movingAvg7d",
    "movingAvg30d",
    "weeklyTrend",
    "monthlyTrend",
    "holidayIndicator",
  ];

  constructor(metricsFetcher: MetricsFetcher) {
    this.metricsFetcher = metricsFetcher;
  }

  private normalizeValue(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  async engineerFeatures(product: Product): Promise<number[]> {
    const metrics = await this.metricsFetcher.getProductMetrics(product);
    const stats = this.metricsFetcher.getCategoryStats(product.category);

    // Use live scraped competitor prices; fall back to real category mean if scrape fails.
    let competitorPrice = 0;

    try {
      const liveCompetitor = await getLiveCompetitorPrices(product, {
        allowLiveScrape: true,
      });
      competitorPrice = liveCompetitor.averagePrice;
    } catch {
      // scrape failed — use actual category mean from DB (real data)
      competitorPrice = stats ? stats.mean : product.price;
    }

    if (competitorPrice <= 0) {
      competitorPrice = stats ? stats.mean : product.price;
    }

    // Better customer segment based on product price tier
    const customerSegment = product.price > 10000 ? 0.8 : product.price > 5000 ? 0.5 : 0.2;

    // Promotion history based on price vs cost margin
    const marginPercent = product.price > 0 ? (product.price - product.costPrice) / product.price : 0;
    const promotionHistory = marginPercent < 0.15 ? 1 : 0; // High margin = less likely to promote

    // Real moving averages from actual order history
    const movingAvg7d = metrics.orders7d;
    const movingAvg30d = metrics.orders30d;
    // Weekly trend: are orders accelerating vs monthly baseline?
    const movingAvg30dWeeklyRate = movingAvg30d / 4;
    const weeklyTrend = movingAvg30dWeeklyRate > 0
      ? (movingAvg7d - movingAvg30dWeeklyRate) / movingAvg30dWeeklyRate
      : 0;
    const monthlyTrend = weeklyTrend * 4;
    const holidayIndicator = this.isHoliday() ? 1 : 0;

    const features: number[] = [
      // Core demand features - normalize based on actual data ranges
      Math.min(metrics.orderCount / 100, 1), 
      Math.min(metrics.views / 1000, 1), 
      Math.min(metrics.conversionRate, 1), 

      // Price positioning features
      stats ? (product.price - stats.mean) / Math.max(stats.std, 100) : 0, // Z-score with minimum std
      stats ? (product.price - stats.min) / Math.max(stats.max - stats.min, 100) : 0.5, // Percentile

      // Inventory features
      Math.min(product.stock / 50, 1), 
      Math.min(metrics.stockVelocity, 1), 

      // Time-based features
      Math.min(metrics.daysOnMarket / 365, 1), 
      stats ? Math.min((metrics.stockVelocity * stats.count) / 1000, 1) : 0,

      // Financial features
      marginPercent, // Profit margin percentage
      product.costPrice / Math.max(product.price, 1), // Cost ratio
      product.moq > 1 ? Math.log(product.moq) / Math.log(10) : 0, // MOQ penalty (log scaled)

      // Category price dynamics
      stats ? (stats.max - stats.min) / Math.max(stats.mean, 100) : 0, // Price range ratio
      // Competitor delta: how far our price sits from live scraped competitor average
      (product.price - competitorPrice) / Math.max(competitorPrice, 100),

      // Seasonal and temporal features
      Math.sin((metrics.daysOnMarket * 2 * Math.PI) / 365), 
      Math.min(Math.abs(metrics.orderCount > 0 ? product.price / metrics.orderCount : 0), 1), 

      // Market competition features
      stats ? Math.min((metrics.stockVelocity * stats.count) / 10000, 1) : 0, 
      stats ? stats.std / Math.max(stats.mean, 100) : 0, // Price volatility

      // External market factors: normalise competitor price against M20 000 ceiling
      Math.min(competitorPrice / 20000, 1),
      customerSegment, 
      promotionHistory, 

      // Trend analysis
      Math.min(movingAvg7d / 50, 1), 
      Math.min(movingAvg30d / 50, 1), 
      Math.max(Math.min(weeklyTrend, 1), -1), 
      Math.max(Math.min(monthlyTrend, 1), -1), 
      holidayIndicator, 
    ];

    return features;
  }

  private isHoliday(): boolean {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    // Simple holiday check (expand in production)
    return (month === 12 && day === 25) || (month === 1 && day === 1) || (month === 11 && (day === 23 || day === 24));
  }

  getFeatureNames(): string[] {
    return this.featureNames;
  }
}

// Decision Tree Node
interface TreeNode {
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number;
  isLeaf: boolean;
}

// Decision Tree for Gradient Boosting
class DecisionTree {
  private root: TreeNode | null = null;
  private maxDepth: number;
  private minSamplesSplit: number = 2;

  constructor(maxDepth: number = 5) {
    this.maxDepth = maxDepth;
  }

  fit(features: number[][], targets: number[]): void {
    this.root = this.buildTree(features, targets, 0);
  }

  private buildTree(features: number[][], targets: number[], depth: number): TreeNode {
    if (depth >= this.maxDepth || targets.length <= this.minSamplesSplit) {
      return {
        value: targets.length > 0 ? targets.reduce((a, b) => a + b, 0) / targets.length : 0,
        isLeaf: true,
      };
    }

    let bestGain = 0;
    let bestFeature = 0;
    let bestThreshold = 0;
    let bestSplit: [number[][], number[], number[][], number[]] | null = null;

    for (let f = 0; f < features[0].length; f++) {
      const featureValues = features.map((row) => row[f]);
      const uniqueValues = Array.from(new Set(featureValues)).sort((a, b) => a - b);

      for (let i = 0; i < Math.min(uniqueValues.length - 1, 10); i++) {
        const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
        const [leftF, leftT, rightF, rightT] = this.splitData(features, targets, f, threshold);

        if (leftT.length === 0 || rightT.length === 0) continue;

        const gain = this.calculateGain(targets, leftT, rightT);
        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = f;
          bestThreshold = threshold;
          bestSplit = [leftF, leftT, rightF, rightT];
        }
      }
    }

    if (!bestSplit || bestGain === 0) {
      return {
        value: targets.length > 0 ? targets.reduce((a, b) => a + b, 0) / targets.length : 0,
        isLeaf: true,
      };
    }

    const [leftF, leftT, rightF, rightT] = bestSplit;
    return {
      feature: bestFeature,
      threshold: bestThreshold,
      left: this.buildTree(leftF, leftT, depth + 1),
      right: this.buildTree(rightF, rightT, depth + 1),
      isLeaf: false,
    };
  }

  private splitData(
    features: number[][],
    targets: number[],
    featureIndex: number,
    threshold: number
  ): [number[][], number[], number[][], number[]] {
    const leftF: number[][] = [];
    const leftT: number[] = [];
    const rightF: number[][] = [];
    const rightT: number[] = [];

    for (let i = 0; i < features.length; i++) {
      if (features[i][featureIndex] <= threshold) {
        leftF.push(features[i]);
        leftT.push(targets[i]);
      } else {
        rightF.push(features[i]);
        rightT.push(targets[i]);
      }
    }

    return [leftF, leftT, rightF, rightT];
  }

  private calculateGain(targets: number[], leftTargets: number[], rightTargets: number[]): number {
    const mse = (values: number[]): number => {
      if (values.length === 0) return 0;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    };

    const parentMse = mse(targets);
    const leftMse = mse(leftTargets);
    const rightMse = mse(rightTargets);

    const weightedMse =
      (leftTargets.length / targets.length) * leftMse +
      (rightTargets.length / targets.length) * rightMse;

    return parentMse - weightedMse;
  }

  predictSingle(features: number[]): number {
    let node = this.root;
    while (node && !node.isLeaf) {
      if (features[node.feature!] <= node.threshold!) {
        node = node.left!;
      } else {
        node = node.right!;
      }
    }
    return node?.value || 0;
  }

  predict(features: number[][]): number[] {
    return features.map((f) => this.predictSingle(f));
  }
}

// Gradient Boosting Regressor (XGBoost-inspired)
class GradientBoostingRegressor {
  private trees: DecisionTree[] = [];
  private learningRate: number;
  private numTrees: number;
  private maxDepth: number;
  private subsample: number;
  private colsampleBytree: number;
  private initialPrediction: number = 0;
  private residuals: number[] = [];
  private modelVersion: string = "3.0.0-xgboost-style";
  private featureImportance: number[] = [];
  private earlyStoppingRounds: number = 10;
  private bestScore: number = -Infinity;
  private bestIteration: number = 0;

  constructor(
    learningRate: number = 0.1,
    numTrees: number = 100,
    maxDepth: number = 5,
    subsample: number = 0.8,
    colsampleBytree: number = 0.8
  ) {
    this.learningRate = learningRate;
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
    this.subsample = subsample;
    this.colsampleBytree = colsampleBytree;
  }

  // Hyperparameter tuning with grid search
  static async tuneHyperparameters(
    features: number[][],
    targets: number[],
    paramGrid: {
      learningRate: number[];
      numTrees: number[];
      maxDepth: number[];
      subsample: number[];
      colsampleBytree: number[];
    }
  ): Promise<{ bestParams: any; bestScore: number }> {
    // This method is deprecated - returning default params
    console.warn("⚠️ tuneHyperparameters is deprecated.");
    const bestParams = { learningRate: 0.1, numTrees: 25, maxDepth: 4, subsample: 0.8, colsampleBytree: 0.8 };
    return { bestParams, bestScore: 0 };
  }

  // Cross-validation
  static async crossValidate(
    features: number[][],
    targets: number[],
    params: { learningRate: number; numTrees: number; maxDepth: number; subsample: number; colsampleBytree: number },
    k: number = 5
  ): Promise<number[]> {
    const foldSize = Math.floor(features.length / k);
    const scores: number[] = [];

    for (let i = 0; i < k; i++) {
      const valStart = i * foldSize;
      const valEnd = i === k - 1 ? features.length : (i + 1) * foldSize;

      const trainFeatures = features.slice(0, valStart).concat(features.slice(valEnd));
      const trainTargets = targets.slice(0, valStart).concat(targets.slice(valEnd));
      const valFeatures = features.slice(valStart, valEnd);
      const valTargets = targets.slice(valStart, valEnd);

      const model = new GradientBoostingRegressor(params.learningRate, params.numTrees, params.maxDepth, params.subsample, params.colsampleBytree);
      await model.train(trainFeatures, trainTargets);
      const predictions = valFeatures.map(f => model.predict(f));
      const r2 = GradientBoostingRegressor.calculateR2(valTargets, predictions);
      scores.push(r2);
    }

    return scores;
  }

  private static calculateR2(targets: number[], predictions: number[]): number {
    const mean = targets.reduce((a, b) => a + b, 0) / targets.length;
    const ssRes = targets.reduce((sum, t, i) => sum + Math.pow(t - predictions[i], 2), 0);
    const ssTot = targets.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0);
    return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  }

  async train(
    features: number[][],
    targets: number[],
    validationFeatures?: number[][],
    validationTargets?: number[]
  ): Promise<{ rmse: number; mae: number; r2: number }> {
    console.log(`🚀 Training XGBoost-style Gradient Boosting Model (${this.numTrees} trees)...`);

    this.initialPrediction = targets.reduce((a, b) => a + b, 0) / targets.length;
    let predictions = new Array(targets.length).fill(this.initialPrediction);
    this.residuals = targets.map((y) => y - this.initialPrediction);

    let noImproveCount = 0;

    for (let i = 0; i < this.numTrees; i++) {
      // Subsample features and samples
      const sampledFeatures = this.subsampleFeatures(features);
      const sampledTargets = this.residuals; // Use current residuals

      const tree = new DecisionTree(this.maxDepth);
      tree.fit(sampledFeatures, sampledTargets);
      this.trees.push(tree);

      const treePredictions = tree.predict(features);
      for (let j = 0; j < predictions.length; j++) {
        predictions[j] += this.learningRate * treePredictions[j];
      }
      this.residuals = targets.map((y, idx) => y - predictions[idx]);

      // Early stopping check
      if (validationFeatures && validationTargets) {
        const valPredictions = validationFeatures.map(f => this.predict(f));
        const valR2 = this.calculateR2(validationTargets, valPredictions);
        if (valR2 > this.bestScore) {
          this.bestScore = valR2;
          this.bestIteration = i;
          noImproveCount = 0;
        } else {
          noImproveCount++;
          if (noImproveCount >= this.earlyStoppingRounds) {
            console.log(`Early stopping at iteration ${i + 1}`);
            this.trees = this.trees.slice(0, this.bestIteration + 1);
            break;
          }
        }
      }

      if ((i + 1) % 25 === 0) {
        const rmse = Math.sqrt(
          this.residuals.reduce((sum, r) => sum + r * r, 0) / this.residuals.length
        );
        console.log(`  Tree ${i + 1}/${this.numTrees} | RMSE: $${rmse.toFixed(2)}`);
      }
    }

    // Calculate feature importance
    this.featureImportance = this.calculateFeatureImportance(features, targets);

    return this.evaluateModel(targets, predictions);
  }

  private subsampleFeatures(features: number[][]): number[][] {
    // Subsample columns (features)
    const numFeatures = Math.floor(features[0].length * this.colsampleBytree);
    const selectedFeatures = new Set<number>();
    while (selectedFeatures.size < numFeatures) {
      selectedFeatures.add(Math.floor(Math.random() * features[0].length));
    }

    return features.map(row =>
      Array.from(selectedFeatures).map(idx => row[idx])
    );
  }

  private calculateFeatureImportance(features: number[][], targets: number[]): number[] {
    const baselineScore = this.calculateR2(targets, features.map(f => this.predict(f)));
    const importance: number[] = new Array(features[0].length).fill(0);

    for (let f = 0; f < features[0].length; f++) {
      // Permute feature
      const permutedFeatures = features.map(row => {
        const permuted = [...row];
        permuted[f] = Math.random(); // Simple permutation
        return permuted;
      });

      const permutedPredictions = permutedFeatures.map(feat => this.predict(feat));
      const permutedScore = this.calculateR2(targets, permutedPredictions);
      importance[f] = baselineScore - permutedScore;
    }

    return importance;
  }

  private calculateR2(targets: number[], predictions: number[]): number {
    const mean = targets.reduce((a, b) => a + b, 0) / targets.length;
    const ssRes = targets.reduce((sum, t, i) => sum + Math.pow(t - predictions[i], 2), 0);
    const ssTot = targets.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0);
    return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  }

  private evaluateModel(
    targets: number[],
    predictions: number[]
  ): { rmse: number; mae: number; r2: number } {
    const rmse = Math.sqrt(
      this.residuals.reduce((sum, r) => sum + r * r, 0) / this.residuals.length
    );
    const mae = this.residuals.reduce((sum, r) => sum + Math.abs(r), 0) / this.residuals.length;

    const yMean = targets.reduce((a, b) => a + b, 0) / targets.length;
    const ssRes = this.residuals.reduce((sum, r) => sum + r * r, 0);
    const ssTot = targets.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return { rmse, mae, r2 };
  }

  predict(features: number[]): number {
    let prediction = this.initialPrediction;
    for (const tree of this.trees) {
      prediction += this.learningRate * tree.predictSingle(features);
    }

    // Ensure prediction is reasonable - if it's too low, use a rule-based fallback
    if (prediction < 300) {
      // Rule-based fallback: base price on cost + margin + category adjustment
      const costPrice = features[10] > 0 ? features[10] * prediction : prediction; // Approximate cost from features
      const categoryMultiplier = 1 + features[3] * 0.5; // Adjust based on price z-score
      prediction = Math.max(costPrice * 1.25 * categoryMultiplier, 400); // Minimum 25% margin, minimum 400
    }

    return Math.max(prediction, 200); // Minimum price floor increased from 10 to 200
  }

  getModelVersion(): string {
    return this.modelVersion;
  }

  getFeatureImportance(): number[] {
    return this.featureImportance;
  }

  getTrees(): DecisionTree[] {
    return this.trees;
  }
}

/**
 * XGBoost hyperparameters for the gradient boosting ensemble
 */
type XGBParams = {
  learningRate: number;   // eta: step size shrinkage (0.1 = 10% contribution per tree)
  numTrees: number;       // Number of boosting rounds
  maxDepth: number;       // Max tree depth (controls complexity)
  subsample: number;      // Row subsampling ratio (0-1)
  colsampleBytree: number; // Column subsampling ratio (0-1)
};

/*
  Adapter for XGBoost WASM Implementation
  Failing to dispose() will cause "FetchedValue has been disposed" errors.
 */
class XGBoostRegressorAdapter {
  private model: XGBModel | null = null;
  private params: XGBParams;
  private featureImportance: number[] = [];
  private modelVersion: string = "xgboost-wasm-3.2.0";

  constructor(params: XGBParams) {
    this.params = params;
  }

  /**
   * Lazy initialization of XGBoost WASM model
   * Async because XGBModel.create() loads the WebAssembly module
   */
  private async ensureModel(): Promise<void> {
    if (!this.model) {
      // Create XGBoost booster with squared error loss for regression
      this.model = await XGBModel.create({
        objective: "reg:squarederror",        // L2 regression loss
        max_depth: this.params.maxDepth,      // Tree complexity limit
        eta: this.params.learningRate,        // Boosting shrinkage
        numRound: this.params.numTrees,       // Total boosting iterations
        subsample: this.params.subsample,     // Random row sampling
        colsample_bytree: this.params.colsampleBytree, // Random feature sampling
        verbosity: 0,                         // Silent mode
      });
    }
  }

  /**
   * Train XGBoost on features and target prices
   * 
   * Algorithm flow:
   * 1. Initialize WASM XGBoost model if needed
   * 2. Fit model using gradient boosting on residuals
   * 3. Make predictions on training data
   * 4. Evaluate: RMSE, MAE, R² score
   * 5. Compute permutation feature importance
   */
  async train(features: number[][], targets: number[]): Promise<{ rmse: number; mae: number; r2: number }> {
    await this.ensureModel();
    // Fit XGBoost: iteratively adds trees that fit residuals of previous trees
    this.model!.fit(features, targets);
    // Get predictions from the trained ensemble
    const predictions = Array.from(this.model!.predict(features), (v) => Number(v));
    // Evaluate model accuracy
    const metrics = this.evaluate(targets, predictions);
    // Compute which features matter most
    this.featureImportance = this.computePermutationImportance(features, targets, metrics.r2);
    return metrics;
  }

  /**
   * Predict price for a single product
   * @param features - 26 engineered features
   * @returns Predicted price with minimum floor of M200
   */
  predict(features: number[]): number {
    if (!this.model) {
      throw new Error("XGBoost model is not initialized. Train the model first.");
    }

    // XGBoost prediction: ensemble sum of tree outputs weighted by shrinkage
    const pred = this.model.predict([features])[0];
    // Apply minimum price floor
    return Math.max(pred, 200);
  }

  getFeatureImportance(): number[] {
    return this.featureImportance;
  }

  getModelVersion(): string {
    return this.modelVersion;
  }

  /**
   * Free WASM memory - CRITICAL for XGBoost WASM library
   * Prevents "FetchedValue has been disposed" errors
   * Must be called when switching models or during cleanup
   */
  dispose(): void {
    if (this.model) {
      // Free WASM heap memory - not garbage collected
      this.model.dispose();
      this.model = null;
    }
  }

  /**
   * Evaluate model accuracy metrics
   * 
   * Metrics:
   * - RMSE: Root Mean Squared Error (penalizes large errors)
   * - MAE: Mean Absolute Error (average error magnitude)
   * - R²: Coefficient of determination (% variance explained, 0-1)
   */
  private evaluate(targets: number[], predictions: number[]): { rmse: number; mae: number; r2: number } {
    const n = Math.max(targets.length, 1);
    const errors = targets.map((t, i) => t - predictions[i]);
    // Mean Squared Error
    const mse = errors.reduce((sum, e) => sum + e * e, 0) / n;
    const rmse = Math.sqrt(mse);
    // Mean Absolute Error
    const mae = errors.reduce((sum, e) => sum + Math.abs(e), 0) / n;
    const r2 = this.calculateR2(targets, predictions);
    return { rmse, mae, r2 };
  }

  /**
   * R² Score: Coefficient of Determination
   * 
   * Measures: (1 - unexplained_variance / total_variance)
   * Range: 0 to 1, where 1 = perfect predictions
   * Interpretation: % of price variance explained by the model
   */
  private calculateR2(targets: number[], predictions: number[]): number {
    const mean = targets.reduce((a, b) => a + b, 0) / Math.max(targets.length, 1);
    const ssRes = targets.reduce((sum, t, i) => sum + Math.pow(t - predictions[i], 2), 0);
    const ssTot = targets.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0);
    return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  }

  /**
   * Permutation Feature Importance
   * 
   * For each feature:
   * 1. Shuffle its values randomly
   * 2. Predict with shuffled feature
   * 3. Measure R² drop = importance
   * 
   * Higher drop = more important feature
   * Explains which engineered features matter most for pricing
   */
  private computePermutationImportance(features: number[][], targets: number[], baselineR2: number): number[] {
    if (features.length === 0) return [];
    const featureCount = features[0].length;
    const importance = new Array(featureCount).fill(0);

    // Test each feature
    for (let f = 0; f < featureCount; f++) {
      // Create a copy and shuffle one feature
      const permuted = features.map((row) => [...row]);
      // Fisher-Yates shuffle for feature column
      for (let i = permuted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = permuted[i][f];
        permuted[i][f] = permuted[j][f];
        permuted[j][f] = tmp;
      }

      // Get R² with shuffled feature
      const preds = Array.from(this.model!.predict(permuted), (v) => Number(v));
      const permutedR2 = this.calculateR2(targets, preds);
      // Importance = drop in R² when this feature is randomized
      importance[f] = Math.max(0, baselineR2 - permutedR2);
    }

    return importance;
  }
}

// Main Pricing Model: Production-grade AI pricing engine
 

 
export class DynamicPricingModel {
  private metricsFetcher: MetricsFetcher;
  private featureEngine: FeatureEngine;
  private model: XGBoostRegressorAdapter;
  private isTrained: boolean = false;
  private trainingMetrics: { rmse: number; mae: number; r2: number } | null = null;
  private predictionCache: Map<number, { result: PricingResult; timestamp: number }> = new Map();
  private cacheTTL: number = 30 * 1000; // 30 seconds for realtime pricing/event updates

  // Model metadata properties
  private modelVersion: string = "1.0.0";
  private lastTrained: Date = new Date();
  private trainingDataSize: number = 0;
  private hyperparameters: Record<string, any> = {};
  private modelPerformance: { mse: number; rmse: number; mae: number; r2: number; crossValidationScore: number } = {
    mse: 0, rmse: 0, mae: 0, r2: 0, crossValidationScore: 0
  };
  private featureImportance: Record<string, number> = {};
  private trainingHistory: Array<{ timestamp: Date; duration: number; finalLoss: number; iterations: number }> = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private isTraining: boolean = false; // Prevent concurrent training to avoid WASM memory leaks
  private trainingPromise: Promise<{ rmse: number; mae: number; r2: number }> | null = null;
  private datasetPriceByName: Map<string, number> = new Map();
  private datasetGlobalMinPrice: number = 0;

  /**
   * Initialize pricing model with XGBoost ensemble
   * Hyperparameters optimized for e-commerce pricing:
   * - 100 boosting rounds balances accuracy vs overfitting
   * - 5 depth limits tree complexity (prevents memorization)
   * - 0.1 learning rate = gradual optimization
   */
  constructor() {
    this.metricsFetcher = new MetricsFetcher();
    this.featureEngine = new FeatureEngine(this.metricsFetcher);
    this.loadDatasetBaselines();
    // Initialize with default hyperparameters
    this.model = new XGBoostRegressorAdapter({
      learningRate: 0.1,
      numTrees: 100,
      maxDepth: 5,
      subsample: 0.8,
      colsampleBytree: 0.8,
    });
  }

  private loadDatasetBaselines(): void {
    try {
      if (!fs.existsSync(SEED_DATASET_PATH)) return;

      const raw = fs.readFileSync(SEED_DATASET_PATH, "utf-8");
      const rows = JSON.parse(raw) as Array<{ name?: string; price?: number }>;

      let minPrice = Number.POSITIVE_INFINITY;
      for (const row of rows) {
        if (!row?.name || typeof row.price !== "number" || row.price <= 0) continue;
        this.datasetPriceByName.set(normalizeProductName(row.name), row.price);
        if (row.price < minPrice) minPrice = row.price;
      }

      if (Number.isFinite(minPrice)) {
        this.datasetGlobalMinPrice = minPrice;
      }
    } catch (error: any) {
      console.warn(`[PricingModel] Could not load dataset baselines: ${error.message}`);
    }
  }

  private getDatasetGuardFloor(product: Product): number {
    const baseline = this.datasetPriceByName.get(normalizeProductName(product.name));
    if (baseline && baseline > 0) {
      return baseline * DATASET_MIN_RATIO;
    }

    if (this.datasetGlobalMinPrice > 0) {
      return this.datasetGlobalMinPrice * DATASET_MIN_RATIO;
    }

    return 200;
  }

  async initialize(): Promise<void> {
    await this.metricsFetcher.initialize();
  }

  async trainModel(): Promise<{ rmse: number; mae: number; r2: number }> {
    // Prevent concurrent training; callers await the same in-flight training.
    if (this.isTraining && this.trainingPromise) {
      console.log("Training already in progress");
      return await this.trainingPromise;
    }

    this.isTraining = true;
    this.trainingPromise = (async () => {
      try {
        const allProducts = await db.select().from(products);

        if (allProducts.length === 0) {
          console.warn("⚠️ No products found for training");
          return { rmse: 0, mae: 0, r2: 0 };
        }

        const features: number[][] = [];
        const labels: number[] = [];

        for (const product of allProducts) {
          const metrics = await this.metricsFetcher.getProductMetrics(product);
          const stats = this.metricsFetcher.getCategoryStats(product.category);
          const engineeredFeatures = await this.featureEngine.engineerFeatures(product);
          const target = this.computeOptimalTrainingLabel(product, metrics, stats);

          features.push(engineeredFeatures);
          labels.push(target);
        }

        // Diagnostic: Check data variance
        const labelMean = labels.reduce((a, b) => a + b, 0) / Math.max(labels.length, 1);
        const labelVariance = labels.reduce((sum, l) => sum + Math.pow(l - labelMean, 2), 0) / Math.max(labels.length, 1);
        const labelStd = Math.sqrt(labelVariance);
        const labelMin = Math.min(...labels);
        const labelMax = Math.max(...labels);
        console.log(`📊 Training Data: ${labels.length} samples, Target range=[${labelMin.toFixed(0)}-${labelMax.toFixed(0)}], Mean=${labelMean.toFixed(0)}, Std=${labelStd.toFixed(2)}`);

        if (labelStd < 1) {
          console.warn("⚠️ Warning: Target prices have very low variance. Model may not learn well. Consider checking if products have sufficient order history.");
        }

        const splits = createDataSplits(features.length);
        const trainFeatures = subsetByIndices(features, splits.trainIdx);
        const trainLabels = subsetByIndices(labels, splits.trainIdx);
        const valFeatures = subsetByIndices(features, splits.valIdx);
        const valLabels = subsetByIndices(labels, splits.valIdx);
        const testFeatures = subsetByIndices(features, splits.testIdx);
        const testLabels = subsetByIndices(labels, splits.testIdx);

        const hasValidation = valFeatures.length > 0;
        const hasTest = testFeatures.length > 0;

        console.log(
          `🧪 Data split -> train: ${trainFeatures.length}, val: ${valFeatures.length}, test: ${testFeatures.length}`,
        );

        // Hyperparameter tuning uses validation score and k-fold CV on training set.
        console.log("🔧 Performing optimized hyperparameter selection...");
        const bestParams = await this.selectBestHyperparameters(
          trainFeatures,
          trainLabels,
          valFeatures,
          valLabels,
        );
        console.log(`Best hyperparameters: ${JSON.stringify(bestParams)}`);

        // Update model with best params
        this.model.dispose();
        this.model = new XGBoostRegressorAdapter({
          learningRate: bestParams.learningRate,
          numTrees: bestParams.numTrees,
          maxDepth: bestParams.maxDepth,
          subsample: bestParams.subsample,
          colsampleBytree: bestParams.colsampleBytree,
        });

        const fitFeatures = hasValidation
          ? trainFeatures.concat(valFeatures)
          : trainFeatures;
        const fitLabels = hasValidation
          ? trainLabels.concat(valLabels)
          : trainLabels;

        const trainingStart = Date.now();
        const fitMetrics = await this.model.train(fitFeatures, fitLabels);
        const trainingDuration = Date.now() - trainingStart;

        const evaluationFeatures = hasTest ? testFeatures : fitFeatures;
        const evaluationLabels = hasTest ? testLabels : fitLabels;
        const evaluationPredictions = evaluationFeatures.map((feature) => this.model.predict(feature));
        this.trainingMetrics = this.evaluateRegressionMetrics(evaluationLabels, evaluationPredictions);

        this.isTrained = true;
        this.predictionCache.clear();
        this.lastTrained = new Date();
        this.trainingDataSize = features.length;
        this.hyperparameters = bestParams;

        // Update performance metrics
        this.modelPerformance = {
          mse: this.trainingMetrics.rmse ** 2, // Approximate MSE from RMSE
          rmse: this.trainingMetrics.rmse,
          mae: this.trainingMetrics.mae,
          r2: this.trainingMetrics.r2,
          crossValidationScore: bestParams.cvR2,
        };

        // Update feature importance
        const importance = this.model.getFeatureImportance();
        const featureNames = this.featureEngine.getFeatureNames();
        this.featureImportance = {};
        importance.forEach((imp, i) => {
          this.featureImportance[featureNames[i]] = imp;
        });

        // Add to training history
        this.trainingHistory.push({
          timestamp: this.lastTrained,
          duration: trainingDuration,
          finalLoss: fitMetrics.rmse,
          iterations: bestParams.numTrees
        });

        console.log(`✅ Model Training Complete`);
        console.log(`   RMSE (${hasTest ? "test" : "fit"}): $${this.trainingMetrics.rmse.toFixed(2)}`);
        console.log(`   MAE (${hasTest ? "test" : "fit"}): $${this.trainingMetrics.mae.toFixed(2)}`);
        console.log(`   R² Score (${hasTest ? "test" : "fit"}): ${(this.trainingMetrics.r2 * 100).toFixed(1)}%`);
        console.log(`   Cross-Validation R² (train folds): ${(bestParams.cvR2 * 100).toFixed(1)}%`);

        // Log feature importance
        console.log("📊 Feature Importance:");
        importance.forEach((imp, i) => {
          console.log(`   ${featureNames[i]}: ${imp.toFixed(4)}`);
        });

        return this.trainingMetrics;
      } catch (error) {
        console.error("❌ Error during model training:", error);
        this.isTrained = false;
        // Ensure model is disposed on error
        this.model.dispose();
        // Reinitialize with fresh model
        this.model = new XGBoostRegressorAdapter({
          learningRate: 0.1,
          numTrees: 100,
          maxDepth: 5,
          subsample: 0.8,
          colsampleBytree: 0.8,
        });
        throw error;
      } finally {
        this.isTraining = false;
        this.trainingPromise = null;
      }
    })();

    return await this.trainingPromise;
  }

  /**
   * Select best hyperparameters using grid search
   * 
   * Tests 3 parameter sets and returns the one with highest R²
   * Each set is trained independently, then disposed
   * 
   * Parameter sets:
   * - Conservative: numRound=20, depth=3 (fast, less overfit)
   * - Balanced: numRound=30, depth=4 (tradeoff)
   * - Complex: numRound=25, depth=3 with lower LR (exploration)
   */
  private async selectBestHyperparameters(
    trainFeatures: number[][],
    trainLabels: number[],
    valFeatures: number[][],
    valLabels: number[],
  ): Promise<{
    learningRate: number;
    numTrees: number;
    maxDepth: number;
    subsample: number;
    colsampleBytree: number;
    cvR2: number;
  }> {
    // Use a more efficient parameter selection with simpler models
    const paramOptions = [
      { learningRate: 0.1, numTrees: 20, maxDepth: 3, subsample: 0.8, colsampleBytree: 0.8 },
      { learningRate: 0.1, numTrees: 30, maxDepth: 4, subsample: 0.8, colsampleBytree: 0.8 },
      { learningRate: 0.05, numTrees: 25, maxDepth: 3, subsample: 0.8, colsampleBytree: 0.8 },
    ];

    let bestScore = -Infinity;
    let bestParams = { ...paramOptions[0], cvR2: 0 };

    for (const params of paramOptions) {
      let model: XGBoostRegressorAdapter | null = null;
      try {
        model = new XGBoostRegressorAdapter({
          learningRate: params.learningRate,
          numTrees: params.numTrees,
          maxDepth: params.maxDepth,
          subsample: params.subsample,
          colsampleBytree: params.colsampleBytree,
        });

        await model.train(trainFeatures, trainLabels);

        const valR2 = valFeatures.length > 0
          ? this.evaluateRegressionMetrics(
              valLabels,
              valFeatures.map((feature) => model!.predict(feature)),
            ).r2
          : this.evaluateRegressionMetrics(
              trainLabels,
              trainFeatures.map((feature) => model!.predict(feature)),
            ).r2;

        const kFolds = Math.min(5, Math.max(2, Math.floor(trainFeatures.length / 5)));
        const cvR2 = await this.evaluateWithKFold(trainFeatures, trainLabels, params, kFolds);
        const blendedScore = (valR2 * 0.7) + (cvR2 * 0.3);

        if (blendedScore > bestScore) {
          bestScore = blendedScore;
          bestParams = { ...params, cvR2 };
        }
      } catch (error) {
        console.warn(`Failed to train with params ${JSON.stringify(params)}:`, error);
      } finally {
        // ALWAYS dispose model - prevents WASM memory leaks even on error
        if (model) {
          model.dispose();
        }
      }
    }

    return bestParams;
  }

  private async evaluateWithKFold(
    features: number[][],
    labels: number[],
    params: XGBParams,
    kFolds: number,
  ): Promise<number> {
    if (features.length < 4) return 0;

    const effectiveKFolds = Math.min(kFolds, features.length);
    const shuffled = shuffleIndices(features.length);
    const foldSize = Math.max(1, Math.floor(features.length / effectiveKFolds));
    const scores: number[] = [];

    for (let fold = 0; fold < effectiveKFolds; fold += 1) {
      const start = fold * foldSize;
      const end = fold === effectiveKFolds - 1 ? shuffled.length : Math.min(shuffled.length, start + foldSize);
      const valIdx = shuffled.slice(start, end);
      const trainIdx = shuffled.filter((_, idx) => idx < start || idx >= end);

      if (valIdx.length === 0 || trainIdx.length === 0) continue;

      const foldTrainFeatures = subsetByIndices(features, trainIdx);
      const foldTrainLabels = subsetByIndices(labels, trainIdx);
      const foldValFeatures = subsetByIndices(features, valIdx);
      const foldValLabels = subsetByIndices(labels, valIdx);

      let foldModel: XGBoostRegressorAdapter | null = null;
      try {
        foldModel = new XGBoostRegressorAdapter(params);
        await foldModel.train(foldTrainFeatures, foldTrainLabels);
        const preds = foldValFeatures.map((feature) => foldModel!.predict(feature));
        const metrics = this.evaluateRegressionMetrics(foldValLabels, preds);
        scores.push(metrics.r2);
      } finally {
        foldModel?.dispose();
      }
    }

    return average(scores);
  }

  private evaluateRegressionMetrics(
    targets: number[],
    predictions: number[],
  ): { rmse: number; mae: number; r2: number } {
    const n = Math.max(targets.length, 1);
    const errors = targets.map((target, idx) => target - (predictions[idx] ?? 0));
    const mse = errors.reduce((sum, error) => sum + error * error, 0) / n;
    const rmse = Math.sqrt(mse);
    const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / n;

    const targetMean = average(targets);
    const ssRes = errors.reduce((sum, error) => sum + error * error, 0);
    const ssTot = targets.reduce((sum, value) => sum + Math.pow(value - targetMean, 2), 0);
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return { rmse, mae, r2 };
  }

  private computeOptimalTrainingLabel(product: Product, metrics: ProductMetrics, stats: CategoryStats | null): number {
    // Use the real price products actually sold at (revenue-weighted avg unit price).
    // This is the only honest training signal — the price the market accepted.
    if (metrics.avgUnitPrice > 0 && metrics.orderCount >= 2) {
      // If conversion is high, the product could bear a higher price.
      // Small uplift: 0% at 0% conversion, capped at +20% at high conversion.
      const conversionUplift = 1 + Math.min(metrics.conversionRate * 0.4, 0.20);
      // If recent demand is accelerating (7-day > monthly average), nudge price up slightly.
      const trendUplift = metrics.orders30d > 0
        ? 1 + Math.min(Math.max((metrics.orders7d * 4 - metrics.orders30d) / metrics.orders30d, 0) * 0.1, 0.10)
        : 1;
      const label = metrics.avgUnitPrice * conversionUplift * trendUplift;
      return Math.max(label, product.costPrice * 1.15, 200);
    }

    // Single order: use that sale price with no uplift (not enough signal yet).
    if (metrics.avgUnitPrice > 0 && metrics.orderCount === 1) {
      return Math.max(metrics.avgUnitPrice, product.costPrice * 1.15, 200);
    }

    // No orders yet: fall back to cost + margin + category positioning.
    const marginPercent = product.price > 0 ? (product.price - product.costPrice) / product.price : 0.25;
    const desiredMargin = Math.max(marginPercent, 0.25);
    const categoryAdjustment = stats ? Math.max(0.85, Math.min(1.2, stats.mean / Math.max(product.price, 1))) : 1;
    const suggestedPrice = product.costPrice * (1 + desiredMargin) * categoryAdjustment;
    return Math.max(suggestedPrice, product.costPrice * 1.2, 200);
  }

  /**
   * Generate real-time live features for surge pricing
   * 
   * These features capture market dynamics:
   * - demandSpike: Real-time viewing/ordering surge (0-1)
   * - userActivity: Concurrent user engagement (0-1)
   * - timeOfDay: Peak hour multiplier (0.7-1.3)
   * - stockPressure: Inventory scarcity signal (0-1)
   * 
   * Simulates live signals that would normally come from analytics/websockets
   * Component of Uber-style dynamic pricing
   */
  private generateLiveFeatures(product: Product, metrics: ProductMetrics): { 
    demandSpike: number; 
    userActivity: number; 
    timeOfDay: number; 
    stockPressure: number 
  } {
    // demandSpike: real average views per day, normalised to 0-1 ceiling at 200 views/day
    const viewsPerDay = metrics.views / Math.max(metrics.daysOnMarket, 1);
    const demandSpike = Math.min(1.0, viewsPerDay / 200);

    // userActivity: real 7-day order rate normalised to 0-1 (ceiling at 10 orders/week)
    const userActivity = Math.min(1.0, metrics.orders7d / 10);

    // timeOfDay: hourly cyclical encoding — varies across the day for realistic demand seasonality
    // Uses cosine so that midnight wraps cleanly; hour-of-day captures time-based demand patterns
    const now = new Date();
    const hourFraction = now.getHours();
    const timeOfDay = 0.5 + 0.5 * Math.cos((hourFraction / 24) * 2 * Math.PI);

    // stockPressure: data-driven from real stock level
    let stockPressure = 0.5;
    if (product.stock < 10) {
      stockPressure = Math.min(1.0, 0.7 + (10 - product.stock) * 0.03);
    } else if (product.stock < 50) {
      stockPressure = 0.3 + (50 - product.stock) / 50 * 0.5;
    } else {
      stockPressure = Math.max(0.1, 50 / Math.max(product.stock, 1) * 0.3);
    }

    return {
      demandSpike: Number(demandSpike.toFixed(3)),
      userActivity: Number(userActivity.toFixed(3)),
      timeOfDay: Number(timeOfDay.toFixed(3)),
      stockPressure: Number(stockPressure.toFixed(3))
    };
  }

  /**
   * Apply dynamic surge pricing rules (Uber/Amazon style)
   * 
   * Real-time adjustment logic:
   * - High demand spike (+20%): "Demand surge detected"
   * - Low stock pressure (+15%): "Limited inventory"
   * - Peak hours (+10%): "Peak time multiplier"
   * - Off-peak discount (-5%): "Off-peak special"
   * - High user activity (+8%): "Competitor pressure"
   * 
   * Adjustments are multiplicative to prevent price explosion:
   * Max increase: +30% above model prediction
   * Max decrease: -10% below model prediction
   * 
   * Applied after base model prediction but before constraints
   */
  private applyDynamicRules(
    basePrice: number,
    product: Product,
    liveFeatures: { demandSpike: number; userActivity: number; timeOfDay: number; stockPressure: number },
    currentPrice: number
  ): { adjustedPrice: number; adjustmentFactor: number; surgeReasons: string[] } {
    let priceMultiplier = 1.0;
    const surgeReasons: string[] = [];
    
    // High demand spike: increase up to 20%
    if (liveFeatures.demandSpike > 0.7) {
      const demandAdjust = 1 + (liveFeatures.demandSpike - 0.7) * 0.3; // 0-20% increase
      priceMultiplier *= demandAdjust;
      surgeReasons.push(`Demand surge (${(liveFeatures.demandSpike * 100).toFixed(0)}%)`);
    }
    
    // Stock pressure: increase up to 15% when stock is low
    if (liveFeatures.stockPressure > 0.5) {
      const stockAdjust = 1 + (liveFeatures.stockPressure - 0.5) * 0.3; // 0-15% increase
      priceMultiplier *= stockAdjust;
      surgeReasons.push(`Limited inventory (${product.stock} units)`);
    }
    
    // Peak hour multiplier: increase up to 10%
    if (liveFeatures.timeOfDay > 1.0) {
      const timeAdjust = 1 + (liveFeatures.timeOfDay - 1.0) * 0.1; // 0-10% increase
      priceMultiplier *= timeAdjust;
      surgeReasons.push(`Peak time pricing`);
    }
    
    // Off-peak discount: decrease up to 5%
    if (liveFeatures.timeOfDay < 0.8) {
      const discountAdjust = 1 - (0.8 - liveFeatures.timeOfDay) * 0.1; // 0-5% decrease
      priceMultiplier *= discountAdjust;
      surgeReasons.push(`Off-peak discount`);
    }
    
    // High user activity and competition: increase up to 8%
    if (liveFeatures.userActivity > 0.8) {
      const activityAdjust = 1 + (liveFeatures.userActivity - 0.8) * 0.4; // 0-8% increase
      priceMultiplier *= activityAdjust;
      surgeReasons.push(`High market activity`);
    }
    
    // Cap adjustment factors to prevent price explosion
    const maxMultiplier = 1.3; // Maximum +30% increase
    const minMultiplier = 0.9; // Maximum -10% decrease
    priceMultiplier = Math.max(minMultiplier, Math.min(maxMultiplier, priceMultiplier));
    
    const adjustedPrice = basePrice * priceMultiplier;
    
    // Suppress adjustments smaller than 0.3% (tiny float noise)
    const adjustmentPercent = (adjustedPrice - basePrice) / basePrice;
    if (Math.abs(adjustmentPercent) < 0.003) {
      return { adjustedPrice: basePrice, adjustmentFactor: 1.0, surgeReasons: [] };
    }
    
    return {
      adjustedPrice: Number(adjustedPrice.toFixed(2)),
      adjustmentFactor: Number(priceMultiplier.toFixed(3)),
      surgeReasons
    };
  }

  /**
   * Predict single product price
   * 
   * Pipeline:
   * 1. Check 1-hour cache first
   * 2. If not cached: engineer features, run XGBoost, apply constraints
   * 3. Apply dynamic surge pricing rules (real-time adjustments)
   * 4. Compute confidence (0.6-0.98 based on R²)
   * 5. Determine trend: up/down/stable based on % change
   * 6. Generate human-readable explanation
   * 7. Cache result for shorter TTL (5 min instead of 1 hour) for real-time responsiveness
   * 
   * Returns: PricingResult with price, confidence, explanation
   */
  async predictPrice(product: Product): Promise<PricingResult> {
    // Check cache
    const cached = this.predictionCache.get(product.id);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      this.cacheHits++;
      return cached.result;
    }

    this.cacheMisses++;

    if (!this.isTrained) {
      await this.trainModel();
    }

    if (!this.isTrained) {
      throw new Error("XGBoost model is not initialized. Train the model first.");
    }

    const features = await this.featureEngine.engineerFeatures(product);
    let recommendedPrice = this.model.predict(features);
    const currentPrice = product.price;
    const stats = this.metricsFetcher.getCategoryStats(product.category);

    // Rule-based fallback: if ML prediction is unreasonable, use cost-based pricing
    if (recommendedPrice < product.costPrice * 1.1 || recommendedPrice < 200) {
      // Cost-plus pricing with category adjustment
      const basePrice = product.costPrice * 1.3; // 30% margin
      const categoryMultiplier = stats ? (stats.mean / (stats.mean - stats.std + 1)) : 1;
      recommendedPrice = Math.max(basePrice * categoryMultiplier, product.costPrice * 1.2, 200);
    }

    // Generate real-time features for surge pricing
    const metrics = await this.metricsFetcher.getProductMetrics(product);
    const liveFeatures = this.generateLiveFeatures(product, metrics);

    // Apply dynamic surge pricing rules (Uber/Amazon style)
    const dynamicAdjustment = this.applyDynamicRules(recommendedPrice, product, liveFeatures, currentPrice);
    recommendedPrice = dynamicAdjustment.adjustedPrice;

    // Apply business constraints 
    recommendedPrice = this.applyBusinessConstraints(product, currentPrice, recommendedPrice);

    const priceDiff = recommendedPrice - currentPrice;
    const priceDiffPercent = ((priceDiff / currentPrice) * 100).toFixed(1);
    const trend: "up" | "down" | "stable" =
      priceDiff > currentPrice * 0.02
        ? "up"
        : priceDiff < -currentPrice * 0.02
          ? "down"
          : "stable";

    const baseConfidence = Math.min(0.95, 0.65 + (this.trainingMetrics?.r2 || 0) * 0.3);
    const confidence = Number(baseConfidence.toFixed(2));

    const reason = this.generateHumanReadableReason(
      product,
      currentPrice,
      recommendedPrice,
      trend,
      priceDiffPercent,
      stats,
      metrics,
      features,
      dynamicAdjustment.surgeReasons
    );

    const result: PricingResult = {
      productId: product.id,
      productName: product.name,
      currentPrice,
      recommendedPrice: Number(recommendedPrice.toFixed(2)),
      confidence,
      reason,
      trend,
      modelVersion: this.model.getModelVersion(),
      factors: {
        demandScore: features[0] + features[1] + features[2],
        competitorScore: features[3] + features[4],
        stockScore: features[5] + features[6],
        categoryScore: features[8],
        marginScore: features[9] + features[10],
      },
    };

    // Cache result
    this.predictionCache.set(product.id, { result, timestamp: Date.now() });

    return result;
  }

  /**
   * Apply Business Rule Constraints to ML Prediction
   * 
   * Guardrails ensure pricing stays within safe bounds:
   * - Minimum margin: 10% (cost * 1.1)
   * - No more than 30% discount from current price
   * - No more than 50% increase from current price
   * - Category range: [min*0.8, max*1.5]
   * - Cost-based minimum: cost * 1.25 (25% margin)
   * - Absolute floor: M200
   * 
   * Without constraints: ML could suggest unprofitable prices
   */
  private applyBusinessConstraints(product: Product, currentPrice: number, recommendedPrice: number): number {
    // Minimum profit margin: 10%
    const minMarginPrice = product.costPrice / 0.9;
    recommendedPrice = Math.max(recommendedPrice, minMarginPrice);

    // Maximum discount: 30% from current price
    const maxDiscountPrice = currentPrice * 0.7;
    recommendedPrice = Math.max(recommendedPrice, maxDiscountPrice);

    // Maximum price increase: 50% from current price
    const maxIncreasePrice = currentPrice * 1.5;
    recommendedPrice = Math.min(recommendedPrice, maxIncreasePrice);

    // Category price range constraints
    const stats = this.metricsFetcher.getCategoryStats(product.category);
    if (stats) {
      const categoryMin = stats.min * 0.9; // Allow at most 10% below category min
      const categoryMax = stats.max * 1.5; // Allow 50% above max
      recommendedPrice = Math.max(recommendedPrice, categoryMin);
      recommendedPrice = Math.min(recommendedPrice, categoryMax);
    }

    // Minimum price floor based on cost price (at least 20% margin)
    const costBasedMin = product.costPrice * 1.25;
    recommendedPrice = Math.max(recommendedPrice, costBasedMin);

    // Dataset guardrail: don't allow prices too far below seeded baseline.
    const datasetFloor = this.getDatasetGuardFloor(product);
    recommendedPrice = Math.max(recommendedPrice, datasetFloor);

    // Absolute minimum price floor (increased from 10 to 200)
    recommendedPrice = Math.max(recommendedPrice, 200);

    return recommendedPrice;
  }

  /**
   * Generate human-readable explanation for price recommendation
   * 
   * Uses permutation feature importance to identify top 3 drivers:
   * - High order volume → higher demand → price up
   * - Low stock → scarcity premium → price up
   * - Thin margins → unsustainable → price up
   * - Competitor pricing → market alignment
   * 
    */
  private generateHumanReadableReason(
    product: Product,
    currentPrice: number,
    recommendedPrice: number,
    trend: "up" | "down" | "stable",
    priceDiffPercent: string,
    stats: CategoryStats | null,
    metrics: ProductMetrics,
    features: number[],
    surgeReasons: string[] = []
  ): string {
    const reasons: string[] = [];
    const importance = this.model.getFeatureImportance();
    const featureNames = this.featureEngine.getFeatureNames();

    // Inject live competitor context from the scraped competitor price in features
    // features[13] = competitorDelta = (ourPrice - competitorPrice) / competitorPrice
    const competitorDeltaFeature = features[13];
    if (competitorDeltaFeature !== 0) {
      const position = competitorDeltaFeature > 0 ? "above" : "below";
      const pctDiff = Math.abs(competitorDeltaFeature * 100).toFixed(1);
      reasons.push(`current price is ${pctDiff}% ${position} the live competitor market average`);
    }

    // Add surge pricing reasons first (real-time factors take priority)
    if (surgeReasons.length > 0) {
      reasons.push(...surgeReasons);
    }

    // Get top 3 influencing features using SHAP-like contribution
    const featureContributions = importance.map((imp, i) => ({
      name: featureNames[i],
      importance: imp,
      value: features[i],
      contribution: imp * features[i] // Simplified SHAP approximation
    }));
    featureContributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    // Analyze top 3 features (only if we don't already have surge reasons)
    if (surgeReasons.length === 0) {
      for (let i = 0; i < Math.min(3, featureContributions.length); i++) {
        const { name, value, contribution } = featureContributions[i];
        const direction = contribution > 0 ? "increasing" : "decreasing";
        switch (name) {
          case "orderCount":
            if (value > 0.5) reasons.push(`high order volume (${Math.round(value * 50)} orders) ${direction} price`);
            break;
          case "views":
            if (value > 0.5) reasons.push(`strong customer interest (${Math.round(value * 500)} views) ${direction} price`);
            break;
          case "priceZScore":
            if (Math.abs(value) > 0.5) reasons.push(`price positioning relative to category ${direction} recommendation`);
            break;
          case "stock":
            if (value < 0.2) reasons.push(`low inventory levels ${direction} price`);
            break;
          case "marginPercent":
            if (value < 0.3) reasons.push(`low profit margins ${direction} price`);
            break;
          case "competitorPrice":
            reasons.push(`competitor pricing (${value.toFixed(2)}) ${direction} recommendation`);
            break;
          case "seasonalFactor":
            if (Math.abs(value) > 0.5) reasons.push(`seasonal market conditions ${direction} price`);
            break;
          case "holidayIndicator":
            if (value > 0) reasons.push(`holiday season ${direction} price`);
            break;
        }
      }
    }

    // Add specific insights
    if (stats) {
      const pricePosition = (currentPrice - stats.mean) / stats.mean;
      if (Math.abs(pricePosition) > 0.1) {
        const position = pricePosition > 0 ? "above" : "below";
        reasons.push(`current price is ${Math.abs(pricePosition * 100).toFixed(0)}% ${position} category average`);
      }
    }

    if (product.stock < 20) {
      reasons.push(`critical stock level (${product.stock} units remaining)`);
    }

    const currentMargin = (currentPrice - product.costPrice) / currentPrice;
    if (currentMargin < 0.15) {
      reasons.push(`thin profit margin (${(currentMargin * 100).toFixed(0)}%)`);
    }

    // Generate final reason
    let action = "";
    if (trend === "up") {
      action = `increase price by ${priceDiffPercent}% from M${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} to M${recommendedPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    } else if (trend === "down") {
      action = `decrease price by ${Math.abs(Number(priceDiffPercent))}% from M${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} to M${recommendedPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    } else {
      action = `maintain current price at M${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    }

    // Build reason with surge pricing context
    let reasonText = "";
    if (surgeReasons.length > 0) {
      const surgeContext = surgeReasons.join(", ");
      reasonText = `Real-time surge pricing active (${surgeContext}). The AI model recommends to ${action}.`;
    } else {
      reasonText = reasons.length > 0
        ? `Based on ${reasons.join(", ")}, the AI model recommends to ${action}.`
        : `The AI model recommends to ${action} based on comprehensive market analysis.`;
    }

    return reasonText;
  }

  async predictAllProducts(userId?: number): Promise<PricingResult[]> {
    const allProducts = userId
      ? await db.select().from(products).where(sql`${products.userId} = ${userId}`)
      : await db.select().from(products);
    const results: PricingResult[] = [];

    for (const product of allProducts) {
      const result = await this.predictPrice(product);
      results.push(result);
    }

    return results;
  }

  async savePriceRecommendations(userId: number): Promise<void> {
    const predictions = await this.predictAllProducts(userId);

    for (const pred of predictions) {
      await db.insert(priceRecommendations).values({
        userId,
        productId: pred.productId,
        productName: pred.productName,
        currentPrice: pred.currentPrice,
        recommendedPrice: pred.recommendedPrice,
        confidence: pred.confidence,
        reason: pred.reason,
        trend: pred.trend,
      });
    }

    console.log(`✅ Saved ${predictions.length} price recommendations for user ${userId}`);
  }

  getTrainingMetrics(): { rmse: number; mae: number; r2: number } | null {
    return this.trainingMetrics;
  }

  isReady(): boolean {
    return this.isTrained;
  }

  isTrainingInProgress(): boolean {
    return this.isTraining;
  }

  invalidatePredictionCache(productId?: number): void {
    if (typeof productId === "number") {
      this.predictionCache.delete(productId);
      return;
    }

    this.predictionCache.clear();
  }

  getModelVersion(): string {
    return this.model.getModelVersion();
  }

  getCategoryStats(category: string): CategoryStats | null {
    return this.metricsFetcher.getCategoryStats(category);
  }

  getAllCategoryStats(): Map<string, CategoryStats> {
    return this.metricsFetcher.categoryStatsCache;
  }

  // Evaluation and A/B Testing
  async evaluateHistoricalPerformance(): Promise<{
    categoryMetrics: Record<string, { rmse: number; mae: number; r2: number; count: number }>;
    overallMetrics: { rmse: number; mae: number; r2: number };
  }> {
    const allProducts = await db.select().from(products);
    const categoryMetrics: Record<string, { predictions: number[]; actuals: number[]; count: number }> = {};

    for (const product of allProducts) {
      const prediction = await this.predictPrice(product);
      const category = product.category;

      if (!categoryMetrics[category]) {
        categoryMetrics[category] = { predictions: [], actuals: [], count: 0 };
      }

      categoryMetrics[category].predictions.push(prediction.recommendedPrice);
      categoryMetrics[category].actuals.push(product.price); // Using current price as "historical" for simulation
      categoryMetrics[category].count++;
    }

    const result: Record<string, { rmse: number; mae: number; r2: number; count: number }> = {};
    let totalPredictions: number[] = [];
    let totalActuals: number[] = [];

    for (const [category, data] of Object.entries(categoryMetrics)) {
      const rmse = Math.sqrt(
        data.predictions.reduce((sum, pred, i) => sum + Math.pow(pred - data.actuals[i], 2), 0) / data.predictions.length
      );
      const mae = data.predictions.reduce((sum, pred, i) => sum + Math.abs(pred - data.actuals[i]), 0) / data.predictions.length;
      const meanActual = data.actuals.reduce((a, b) => a + b, 0) / data.actuals.length;
      const ssRes = data.predictions.reduce((sum, pred, i) => sum + Math.pow(data.actuals[i] - pred, 2), 0);
      const ssTot = data.actuals.reduce((sum, actual) => sum + Math.pow(actual - meanActual, 2), 0);
      const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

      result[category] = { rmse, mae, r2, count: data.count };
      totalPredictions.push(...data.predictions);
      totalActuals.push(...data.actuals);
    }

    const overallRmse = Math.sqrt(
      totalPredictions.reduce((sum, pred, i) => sum + Math.pow(pred - totalActuals[i], 2), 0) / totalPredictions.length
    );
    const overallMae = totalPredictions.reduce((sum, pred, i) => sum + Math.abs(pred - totalActuals[i]), 0) / totalPredictions.length;
    const overallMean = totalActuals.reduce((a, b) => a + b, 0) / totalActuals.length;
    const overallSsRes = totalPredictions.reduce((sum, pred, i) => sum + Math.pow(totalActuals[i] - pred, 2), 0);
    const overallSsTot = totalActuals.reduce((sum, actual) => sum + Math.pow(actual - overallMean, 2), 0);
    const overallR2 = overallSsTot === 0 ? 0 : 1 - overallSsRes / overallSsTot;

    return {
      categoryMetrics: result,
      overallMetrics: { rmse: overallRmse, mae: overallMae, r2: overallR2 }
    };
  }

  // Simulate A/B testing: static vs dynamic pricing revenue impact
  async simulateABTest(days: number = 30): Promise<{
    staticRevenue: number;
    dynamicRevenue: number;
    improvement: number;
    confidence: number;
  }> {
    const allProducts = await db.select().from(products);
    let staticRevenue = 0;
    let dynamicRevenue = 0;

    for (const product of allProducts) {
      const metrics = await this.metricsFetcher.getProductMetrics(product);
      const dailyOrders = metrics.orderCount / Math.max(metrics.daysOnMarket, 1);

      // Static pricing: current price
      staticRevenue += product.price * dailyOrders * days;

      // Dynamic pricing: recommended price
      const prediction = await this.predictPrice(product);
      dynamicRevenue += prediction.recommendedPrice * dailyOrders * days;
    }

    const improvement = ((dynamicRevenue - staticRevenue) / staticRevenue) * 100;
    const confidence = Math.min(0.95, Math.abs(improvement) / 50); // Simplified confidence calculation

    return { staticRevenue, dynamicRevenue, improvement, confidence };
  }

  /**
   * Get comprehensive model metadata for auditing and API support
   */
  getModelInfo(): ModelInfo {
    return {
      version: this.getModelVersion(),
      lastTrained: this.lastTrained,
      trainingDataSize: this.trainingDataSize,
      features: this.featureEngine.getFeatureNames(),
      hyperparameters: this.hyperparameters,
      performance: this.modelPerformance,
      featureImportance: this.featureImportance,
      trainingHistory: this.trainingHistory,
      cacheStats: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
      }
    };
  }
}

// Singleton instance
let pricingModel: DynamicPricingModel | null = null;
let pricingModelInitializationPromise: Promise<DynamicPricingModel> | null = null;

async function ensurePricingModel(): Promise<DynamicPricingModel> {
  if (pricingModel?.isReady()) {
    return pricingModel;
  }

  if (pricingModelInitializationPromise) {
    return pricingModelInitializationPromise;
  }

  pricingModelInitializationPromise = (async () => {
    if (!pricingModel) {
      pricingModel = new DynamicPricingModel();
      await pricingModel.initialize();
    }

    if (!pricingModel.isReady()) {
      await pricingModel.trainModel();
      console.log("💰 Dynamic Pricing Model Ready!");
    }

    return pricingModel;
  })();

  try {
    return await pricingModelInitializationPromise;
  } finally {
    pricingModelInitializationPromise = null;
  }
}

/**
 * Initialize pricing model: load WASM, fetch metrics, train XGBoost
 * Call this once at server startup
 */
export async function initializePricingModel(): Promise<void> {
  await ensurePricingModel();
}

export async function getInitializedPricingModel(): Promise<DynamicPricingModel> {
  return ensurePricingModel();
}

/**
 * Get price recommendation for a single product
 * Uses cached predictions when available (1 hour TTL)
 */
export async function getPriceRecommendation(product: Product): Promise<PricingResult> {
  const model = await ensurePricingModel();
  return model.predictPrice(product);
}

/**
 * Get price recommendations for all products (user-specific or global)
 * Returns array of PricingResults with recommendations for each product
 */
export async function getPriceRecommendations(userId: number): Promise<PricingResult[]> {
  const model = await ensurePricingModel();
  return model.predictAllProducts(userId);
}

/**
 * Retrain the XGBoost model from scratch
 * Call when new products added or historical data changes significantly
 */
export async function retrainPricingModel(): Promise<{ rmse: number; mae: number; r2: number }> {
  if (!pricingModel) {
    pricingModel = new DynamicPricingModel();
    await pricingModel.initialize();
  }
  return pricingModel.trainModel();
}

export function isPricingModelReady(): boolean {
  return pricingModel?.isReady() || false;
}

export function isPricingModelTraining(): boolean {
  return pricingModel?.isTrainingInProgress() || false;
}

export function invalidatePricePredictionCache(productId?: number): void {
  pricingModel?.invalidatePredictionCache(productId);
}

/**
 * Get model performance metrics from last training
 */
export function getModelMetrics(): { rmse: number; mae: number; r2: number } | null {
  return pricingModel?.getTrainingMetrics() || null;
}

/**
 * Get category statistics (mean, std, quartiles) for market analysis
 */
export function getMarketInsights(category: string): CategoryStats | null {
  return pricingModel?.getCategoryStats(category) || null;
}

export function getAllCategoryStats(): Map<string, CategoryStats> {
  return pricingModel?.getAllCategoryStats() || new Map();
}

/**
 * Get comprehensive model metadata for API and debugging
 */
export function getModelInfo(): ModelInfo | null {
  return pricingModel?.getModelInfo() || null;
}
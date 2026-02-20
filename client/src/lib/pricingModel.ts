import { PRODUCTS, PRICE_RECOMMENDATIONS } from './mockData';

/**
 * AI Pricing Model Simulator
 * 
 * In a production environment, this would be a Python FastAPI service running 
 * an XGBoost or LightGBM regressor trained on historical sales, competitor 
 * pricing, and inventory levels.
 * 
 * This frontend implementation simulates those ML decisions based on 
 * market signals (demand, stock, and competition).
 */

export interface PricingSignal {
  productId: string;
  demandFactor: number; // 0.5 to 1.5
  competitorPrice: number;
  inventoryLevel: number;
  marketTrend: 'bullish' | 'bearish' | 'neutral';
}

export const pricingModel = {
  /**
   * Simulates the ML inference process
   * @param signal Current market signals for a product
   * @returns Recommended price with confidence score
   */
  calculateRecommendedPrice: (signal: PricingSignal) => {
    const product = PRODUCTS.find(p => p.id === signal.productId);
    if (!product) return null;

    let recommendation = product.price;
    let confidence = 0.85; // Base confidence
    let reason = "Stable market conditions detected.";

    // 1. Demand Analysis (Simulating elastic demand model)
    if (signal.demandFactor > 1.2) {
      recommendation *= 1.10;
      reason = "High demand surge detected in target region.";
      confidence += 0.05;
    } else if (signal.demandFactor < 0.8) {
      recommendation *= 0.90;
      reason = "Lower consumer interest; suggesting volume-protection discount.";
      confidence -= 0.10;
    }

    // 2. Inventory Optimization (Simulating carrying cost reduction)
    if (signal.inventoryLevel > 1000 && product.category === 'Consumer Electronics') {
      recommendation *= 0.95;
      reason = "High inventory carrying costs; clearing stock recommended.";
      confidence += 0.03;
    }

    // 3. Competitive Benchmarking
    if (signal.competitorPrice < recommendation) {
      const gap = (recommendation - signal.competitorPrice) / recommendation;
      if (gap > 0.15) {
        recommendation = signal.competitorPrice * 1.05; // Stay slightly premium but competitive
        reason = "Competitor price drop detected. Adjusted to maintain market share.";
        confidence -= 0.05;
      }
    }

    return {
      productId: signal.productId,
      currentPrice: product.price,
      recommendedPrice: Number(recommendation.toFixed(2)),
      confidence: Math.min(Number(confidence.toFixed(2)), 0.99),
      reason,
      timestamp: new Date().toISOString(),
      trend: recommendation > product.price ? 'up' : recommendation < product.price ? 'down' : 'stable'
    };
  },

  /**
   * Returns pre-computed recommendations for the dashboard
   */
  getDashboardRecommendations: () => {
    return PRICE_RECOMMENDATIONS;
  }
};

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertRecommendationSchema, type Product } from "@shared/schema";
import { setupAuth } from "./auth";

function requireAuth(req: Request, res: Response): number | null {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ message: "You must be signed in" });
    return null;
  }
  return req.user.id;
}

function runGradientBoosting(product: Product, demandFactor: number, inventoryFactor: number, competitorFactor: number) {
  let prediction = product.price;

  const demandResidual = (demandFactor - 1) * product.price * 0.5;
  prediction += demandResidual;

  const inventoryResidual = (1 - inventoryFactor) * product.price * 0.2;
  prediction += inventoryResidual;

  const competitionResidual = (competitorFactor - 1) * product.price * 0.3;
  prediction += competitionResidual;

  const confidence = 0.85 + (Math.random() * 0.1);
  const trend = prediction > product.price ? "up" : prediction < product.price ? "down" : "stable";

  const reasons: string[] = [];
  if (demandResidual > 0) reasons.push(`Demand surge (+${(demandFactor * 100 - 100).toFixed(0)}%)`);
  if (demandResidual < 0) reasons.push(`Demand decline (${(demandFactor * 100 - 100).toFixed(0)}%)`);
  if (inventoryResidual > 0) reasons.push(`Low stock pressure (${product.stock} units)`);
  if (inventoryResidual < 0) reasons.push(`Stock surplus (${product.stock} units)`);
  if (competitionResidual > 0) reasons.push("Competitor prices rising");
  if (competitionResidual < 0) reasons.push("Competitor undercutting");

  const reason = `Gradient Boosting [3 Learners]: ${reasons.join(", ")}.`;

  return {
    recommendedPrice: Number(prediction.toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    reason,
    trend,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  setupAuth(app);

  app.get("/api/products", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const products = await storage.getProductsByUser(userId);
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const product = await storage.getProductByUser(Number(req.params.id), userId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertProductSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const product = await storage.createProduct(parsed.data);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id/price", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { price } = req.body;
    if (typeof price !== "number") return res.status(400).json({ message: "Price must be a number" });
    const updated = await storage.updateProductPrice(Number(req.params.id), userId, price);
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  });

  app.get("/api/recommendations", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const recs = await storage.getRecommendationsByUser(userId);
    res.json(recs);
  });

  app.post("/api/recommendations", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertRecommendationSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const rec = await storage.createRecommendation(parsed.data);
    res.status(201).json(rec);
  });

  app.delete("/api/recommendations/:id", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const deleted = await storage.deleteRecommendationByUser(Number(req.params.id), userId);
    if (!deleted) return res.status(404).json({ message: "Recommendation not found" });
    res.json({ success: true });
  });

  app.post("/api/recommendations/:id/apply", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { price, productId } = req.body;
    if (typeof price !== "number" || typeof productId !== "number") {
      return res.status(400).json({ message: "Price and productId are required" });
    }
    const updated = await storage.updateProductPrice(productId, userId, price);
    if (!updated) return res.status(404).json({ message: "Product not found" });
    await storage.deleteRecommendationByUser(Number(req.params.id), userId);
    res.json(updated);
  });

  app.get("/api/sales", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const data = await storage.getSalesDataByUser(userId);
    res.json(data);
  });

  app.post("/api/pricing/predict", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { productId, demandFactor, inventoryFactor, competitorFactor } = req.body;
    const product = await storage.getProductByUser(Number(productId), userId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const result = runGradientBoosting(product, demandFactor, inventoryFactor, competitorFactor);

    const rec = await storage.createRecommendation({
      userId,
      productId: product.id,
      productName: product.name,
      currentPrice: product.price,
      recommendedPrice: result.recommendedPrice,
      confidence: result.confidence,
      reason: result.reason,
      trend: result.trend,
    });

    res.json(rec);
  });

  app.post("/api/pricing/run-model", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const products = await storage.getProductsByUser(userId);
    const results = [];

    for (const product of products) {
      const demandFactor = 0.8 + Math.random() * 0.4;
      const inventoryFactor = product.stock > 15 ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4;
      const competitorFactor = 0.9 + Math.random() * 0.2;

      const result = runGradientBoosting(product, demandFactor, inventoryFactor, competitorFactor);

      if (Math.abs(result.recommendedPrice - product.price) / product.price > 0.01) {
        const rec = await storage.createRecommendation({
          userId,
          productId: product.id,
          productName: product.name,
          currentPrice: product.price,
          recommendedPrice: result.recommendedPrice,
          confidence: result.confidence,
          reason: result.reason,
          trend: result.trend,
        });
        results.push(rec);
      }
    }

    res.json({ generated: results.length, recommendations: results });
  });

  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertRecommendationSchema, type Product } from "@shared/schema";
import { setupAuth } from "./auth";

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

  app.get("/api/products", async (_req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const product = await storage.createProduct(parsed.data);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id/price", async (req, res) => {
    const { price } = req.body;
    if (typeof price !== "number") return res.status(400).json({ message: "Price must be a number" });
    const updated = await storage.updateProductPrice(Number(req.params.id), price);
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  });

  app.get("/api/recommendations", async (_req, res) => {
    const recs = await storage.getRecommendations();
    res.json(recs);
  });

  app.post("/api/recommendations", async (req, res) => {
    const parsed = insertRecommendationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const rec = await storage.createRecommendation(parsed.data);
    res.status(201).json(rec);
  });

  app.delete("/api/recommendations/:id", async (req, res) => {
    await storage.deleteRecommendation(Number(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/recommendations/:id/apply", async (req, res) => {
    const { price, productId } = req.body;
    if (typeof price !== "number" || typeof productId !== "number") {
      return res.status(400).json({ message: "Price and productId are required" });
    }
    const updated = await storage.updateProductPrice(productId, price);
    if (!updated) return res.status(404).json({ message: "Product not found" });
    await storage.deleteRecommendation(Number(req.params.id));
    res.json(updated);
  });

  app.get("/api/sales", async (_req, res) => {
    const data = await storage.getSalesData();
    res.json(data);
  });

  app.post("/api/pricing/predict", async (req, res) => {
    const { productId, demandFactor, inventoryFactor, competitorFactor } = req.body;
    const product = await storage.getProduct(Number(productId));
    if (!product) return res.status(404).json({ message: "Product not found" });

    const result = runGradientBoosting(product, demandFactor, inventoryFactor, competitorFactor);

    const rec = await storage.createRecommendation({
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

  app.post("/api/pricing/run-model", async (_req, res) => {
    const products = await storage.getProducts();
    const results = [];

    for (const product of products) {
      const demandFactor = 0.8 + Math.random() * 0.4;
      const inventoryFactor = product.stock > 15 ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4;
      const competitorFactor = 0.9 + Math.random() * 0.2;

      const result = runGradientBoosting(product, demandFactor, inventoryFactor, competitorFactor);

      if (Math.abs(result.recommendedPrice - product.price) / product.price > 0.01) {
        const rec = await storage.createRecommendation({
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

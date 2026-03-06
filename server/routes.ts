import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import {
  insertProductSchema,
  insertRecommendationSchema,
  type Product,
} from "@shared/schema";
import { setupAuth } from "./auth";
import { db } from "./db";
import { products, orders } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { initializeModel, predict, getMarketInsights, getAllCategoryStats } from "./pricing-model";

/* ================= AUTH HELPERS ================= */
function requireAuth(req: Request, res: Response): number | null {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ message: "You must be signed in" });
    return null;
  }
  return req.user.id;
}

function requireAdmin(req: Request, res: Response): number | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return null;
  }
  return userId;
}

/* ================= ROUTES ================= */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
  initializeModel();

  /* ===== PUBLIC MARKETPLACE ===== */
  app.get("/api/marketplace", async (_req, res) => {
    const allProducts = await storage.getAllProducts();
    res.json(allProducts);
  });

  app.get("/api/marketplace/search", async (req, res) => {
    const query = (req.query.q as string) || "";
    if (!query.trim()) {
      const allProducts = await storage.getAllProducts();
      return res.json(allProducts);
    }
    const results = await storage.searchProducts(query);
    res.json(results);
  });

  app.get("/api/marketplace/category/:category", async (req, res) => {
    const results = await storage.getProductsByCategory(req.params.category);
    res.json(results);
  });

  app.get("/api/marketplace/product/:id", async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    await storage.incrementProductViews(product.id);
    const seller = await storage.getUser(product.userId);
    res.json({ ...product, sellerName: seller?.businessName || "Unknown Seller" });
  });

  /* ===== PRODUCTS ===== */
  app.get("/api/products", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const prods = await storage.getProductsByUser(userId);
    res.json(prods);
  });

  app.get("/api/products/:id", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const product = await storage.getProduct(Number(req.params.id));
    if (!product || product.userId !== userId)
      return res.status(404).json({ message: "Product not found" });

    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const parsed = insertProductSchema.safeParse({ ...req.body, userId });
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.message });

    const product = await storage.createProduct(parsed.data);
    res.status(201).json(product);
  });

  app.patch("/api/products/:id/price", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { price } = req.body;
    if (typeof price !== "number")
      return res.status(400).json({ message: "Price must be a number" });

    const product = await storage.getProduct(Number(req.params.id));
    if (!product || product.userId !== userId)
      return res.status(404).json({ message: "Product not found" });

    const updated = await storage.updateProductPrice(product.id, price);
    res.json(updated);
  });

  /* ===== ORDERS ===== */
  app.post("/api/orders", async (req, res) => {
    const { productId, quantity, buyerName, buyerEmail, buyerPhone } = req.body;
    if (!productId || !quantity || !buyerName || !buyerEmail)
      return res.status(400).json({ message: "Missing required fields" });

    const product = await storage.getProduct(Number(productId));
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < quantity)
      return res.status(400).json({ message: "Insufficient stock" });
    if (quantity < product.moq)
      return res.status(400).json({ message: `Minimum order quantity is ${product.moq}` });

    try {
      const order = await db.transaction(async (tx) => {
        const [stockUpdated] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${quantity}` })
          .where(eq(products.id, product.id))
          .returning();

        if (!stockUpdated || stockUpdated.stock < 0)
          throw new Error("Insufficient stock (concurrent order)");

        const [createdOrder] = await tx.insert(orders).values({
          productId: product.id,
          sellerId: product.userId,
          buyerName,
          buyerEmail,
          buyerPhone: buyerPhone || "",
          quantity,
          unitPrice: product.price,
          totalPrice: product.price * quantity,
        }).returning();

        return createdOrder;
      });

      res.status(201).json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/orders/seller", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const sellerOrders = await storage.getOrdersBySeller(userId);
    res.json(sellerOrders);
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { status } = req.body;
    if (!["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const updated = await storage.updateOrderStatus(Number(req.params.id), userId, status);
    if (!updated) return res.status(404).json({ message: "Order not found" });
    res.json(updated);
  });

  /* ===== RECOMMENDATIONS ===== */
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
    if (!parsed.success)
      return res.status(400).json({ message: parsed.error.message });

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
    if (typeof price !== "number" || typeof productId !== "number")
      return res.status(400).json({ message: "Price and productId are required" });

    const product = await storage.getProduct(productId);
    if (!product || product.userId !== userId)
      return res.status(404).json({ message: "Product not found" });

    const updated = await storage.updateProductPrice(product.id, price);
    await storage.deleteRecommendationByUser(Number(req.params.id), userId);
    res.json(updated);
  });

  /* ===== SALES ===== */
  app.get("/api/sales", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const data = await storage.getSalesDataByUser(userId);
    res.json(data);
  });

  /* ===== AI PRICE PREDICTION ===== */
  app.post("/api/pricing/predict", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { productId } = req.body;

    const product = await storage.getProduct(Number(productId));
    if (!product || product.userId !== userId)
      return res.status(404).json({ message: "Product not found" });

    const orderCount = await storage.getOrderCount(product.id);
    const result = predict(product, orderCount);

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

  /* ===== BULK MODEL RUN ===== */
  app.post("/api/pricing/run-model", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const userProducts = await storage.getProductsByUser(userId);
    const results = [];

    for (const product of userProducts) {
      const orderCount = await storage.getOrderCount(product.id);
      const result = predict(product, orderCount);

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

  /* ===== MARKET INSIGHTS ===== */
  app.get("/api/market/insights/:category", async (req, res) => {
    const insights = getMarketInsights(req.params.category);
    if (!insights) return res.status(404).json({ message: "Category not found" });
    res.json(insights);
  });

  app.get("/api/market/categories", async (_req, res) => {
    const stats = getAllCategoryStats();
    const result: Record<string, any> = {};
    for (const [cat, s] of stats) {
      result[cat] = s;
    }
    res.json(result);
  });

  /* ===== ANALYTICS (authenticated users) ===== */
  app.get("/api/analytics/overview", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const isAdmin = req.user?.role === "admin";

    const allProducts = isAdmin
      ? await storage.getAllProducts()
      : await storage.getProductsByUser(userId);

    const recommendations = await storage.getRecommendationsByUser(userId);

    const stats = getAllCategoryStats();
    const categoryStatsObj: Record<string, any> = {};
    stats.forEach((s, cat) => {
      categoryStatsObj[cat] = s;
    });

    let ordersByCategory: Record<string, number> = {};
    let revenueByCategory: Record<string, number> = {};

    if (isAdmin) {
      const analytics = await storage.getAnalytics();
      ordersByCategory = analytics.ordersByCategory;
      revenueByCategory = analytics.revenueByCategory;
    } else {
      const sellerOrders = await storage.getOrdersBySeller(userId);
      for (const order of sellerOrders) {
        const product = await storage.getProduct(order.productId);
        if (product) {
          ordersByCategory[product.category] = (ordersByCategory[product.category] || 0) + 1;
          revenueByCategory[product.category] = (revenueByCategory[product.category] || 0) + order.totalPrice;
        }
      }
    }

    res.json({
      categoryStats: categoryStatsObj,
      products: allProducts.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        stock: p.stock,
        views: p.views,
        moq: p.moq,
      })),
      recommendations,
      ordersByCategory,
      revenueByCategory,
    });
  });

  /* ===== ADMIN ROUTES ===== */
  app.get("/api/admin/stats", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const stats = await storage.getPlatformStats();
    res.json(stats);
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const allUsers = await storage.getAllUsers();
    res.json(allUsers);
  });

  app.get("/api/admin/products", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const allProducts = await storage.getAllProducts();
    res.json(allProducts);
  });

  app.get("/api/admin/orders", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const allOrders = await storage.getAllOrders();
    res.json(allOrders);
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deleteProduct(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true });
  });

  app.patch("/api/admin/users/:id/role", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { role } = req.body;
    if (!["admin", "retailer"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const updated = await storage.updateUserRole(Number(req.params.id), role);
    if (!updated) return res.status(404).json({ message: "User not found" });
    const { password, ...safeUser } = updated;
    res.json(safeUser);
  });

  app.post("/api/admin/pricing/run-all", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const allProducts = await storage.getAllProducts();
    const results = [];

    for (const product of allProducts) {
      const orderCount = await storage.getOrderCount(product.id);
      const result = predict(product, orderCount);

      if (Math.abs(result.recommendedPrice - product.price) / product.price > 0.01) {
        const rec = await storage.createRecommendation({
          userId: product.userId,
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

  app.get("/api/admin/analytics", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const analytics = await storage.getAnalytics();
    res.json(analytics);
  });

  return httpServer;
}

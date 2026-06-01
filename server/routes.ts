import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import {
  insertProductSchema,
  insertRecommendationSchema,
  priceRecommendations,
  type Product,
} from "@shared/schema";
import { setupAuth } from "./auth";
import { db } from "./db";
import { products, orders } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getPriceRecommendation as predict } from "./pricing-model";
import * as pricing from "./pricing";
import { getAllCategoryStats, getMarketInsights, getModelInfo, isPricingModelReady, isPricingModelTraining } from "./training";
import { runAutoPriceUpdate, getSchedulerStatus } from "./scheduler";
import { sendOrderConfirmationEmail, sendOrderReadyForCollectionEmail, getEmailDeliveryStatus } from "./email";
import { getCompetitorPrices, getCompetitorPricing, searchInternetProducts, getRecentCompetitorPriceChanges, getAllRecentPriceChanges } from "./competitor-pricing";
import { onPriceChange, publishPriceChange } from "./price-events";

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
  const validPaymentMethods = ["cash_on_delivery", "bank_transfer", "card"] as const;
  const normalizePaymentMethod = (value: unknown): "cash_on_delivery" | "bank_transfer" | "card" => {
    if (typeof value !== "string") return "cash_on_delivery";
    if ((validPaymentMethods as readonly string[]).includes(value)) {
      return value as "cash_on_delivery" | "bank_transfer" | "card";
    }
    return "cash_on_delivery";
  };

  setupAuth(app);
  // Remove immediate model initialization - will be done lazily
  // initializeModel();

  /* ===== SYSTEM HEALTH ===== */
  app.get("/api/health", async (_req, res) => {
    const scheduler = getSchedulerStatus();
    const modelInfo = getModelInfo();

    try {
      await db.execute(sql`select 1`);
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        services: {
          database: "ok",
          modelInitialized: Boolean(modelInfo),
          modelReady: isPricingModelReady(),
          modelTraining: isPricingModelTraining(),
          scheduler,
        },
      });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        services: {
          database: "error",
          modelInitialized: Boolean(modelInfo),
          scheduler,
        },
      });
    }
  });

  app.get("/api/price-events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write("retry: 5000\n\n");

    const heartbeat = setInterval(() => {
      res.write(`: keepalive ${Date.now()}\n\n`);
    }, 30000);

    const unsubscribe = onPriceChange((event) => {
      res.write("event: price-change\n");
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  });

  /* ===== PUBLIC MARKETPLACE ===== */
  app.get("/api/marketplace", async (_req, res) => {
    const allProducts = await storage.getAllProducts();
    const productsWithRecommendations = await Promise.all(
      allProducts.map(async (product) => {
        const recommendation = await pricing.getLatestRecommendation(product.id);
        return recommendation
          ? {
              ...product,
              recommendedPrice: recommendation.recommendedPrice,
              recommendedTrend: recommendation.trend,
            }
          : product;
      }),
    );
    res.json(productsWithRecommendations);
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

  /* Smart search: ranked internal results + external marketplace links */
  app.get("/api/marketplace/smart-search", async (req, res) => {
    const query = ((req.query.q as string) || "").trim();
    if (!query) return res.status(400).json({ message: "Query required" });

    const encoded = encodeURIComponent(query);

    const externalLinks = [
      {
        name: "Takealot",
        url: `https://www.takealot.com/all?qsearch=${encoded}`,
        icon: "takealot",
      },
      {
        name: "Amazon",
        url: `https://www.amazon.com/s?k=${encoded}`,
        icon: "amazon",
      },
      {
        name: "Makro",
        url: `https://www.makro.co.za/search/?text=${encoded}`,
        icon: "makro",
      },
      {
        name: "Game",
        url: `https://www.game.co.za/search/?text=${encoded}`,
        icon: "game",
      },
    ];

    const results = await storage.searchProducts(query);
    const allProducts = await storage.getAllProducts();

    // Generate category suggestions from matching products
    const catCounts = new Map<string, number>();
    results.forEach((p) => catCounts.set(p.category, (catCounts.get(p.category) || 0) + 1));
    const suggestedCategories = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count }));

    // Related queries: other terms from matching product names
    const termSet = new Set<string>();
    const qLower = query.toLowerCase();
    results.slice(0, 10).forEach((p) => {
      p.name.toLowerCase().split(/\s+/).forEach((w) => {
        if (w.length > 3 && !qLower.includes(w)) termSet.add(w);
      });
    });
    const relatedTerms = Array.from(termSet).slice(0, 6);

    res.json({
      query,
      totalFound: results.length,
      products: results.slice(0, 20),
      suggestedCategories,
      relatedTerms,
      externalLinks,
      showExternal: results.length < 5,
    });
  });

  app.get("/api/marketplace/internet-search", async (req, res) => {
    const query = ((req.query.q as string) || "").trim();
    const limitRaw = Number(req.query.limit ?? 16);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(40, Math.floor(limitRaw))) : 16;

    if (!query) return res.status(400).json({ message: "Query required" });

    try {
      const items = await searchInternetProducts(query, limit);
      res.json({ query, totalFound: items.length, items });
    } catch (error: any) {
      res.status(500).json({
        message: error?.message || "Internet search failed",
        query,
        totalFound: 0,
        items: [],
      });
    }
  });

  app.get("/api/marketplace/category/:category", async (req, res) => {
    const results = await storage.getProductsByCategory(req.params.category);
    res.json(results);
  });

  app.get("/api/marketplace/product/:id", async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    await storage.incrementProductViews(product.id);
    void pricing.productViewed(product.id).catch((error) => {
      console.error("[Pricing Event] productViewed failed:", error);
    });
    const seller = await storage.getUser(product.userId);
    const recommendation = await pricing.getLatestRecommendation(product.id);
    res.json({
      ...product,
      sellerName: seller?.businessName || "Unknown Seller",
      recommendedPrice: recommendation?.recommendedPrice,
      recommendedTrend: recommendation?.trend,
    });
  });

  app.get("/api/marketplace/product/:id/recommendations", async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const current = await storage.getProduct(productId);
    if (!current) return res.status(404).json({ message: "Product not found" });

    const allProducts = await storage.getAllProducts();
    const currentBrand = (current.name.split(/\s+/)[0] || "").toLowerCase();

    const ranked = allProducts
      .filter((p) => p.id !== current.id && p.stock > 0)
      .map((p) => {
        let score = 0;

        if (p.category === current.category) score += 45;

        const popularity = Math.min(25, p.views / 20 + p.reviews / 4 + p.rating * 2);
        score += popularity;

        const maxPrice = Math.max(current.price, p.price);
        const priceGapRatio = maxPrice > 0 ? Math.abs(current.price - p.price) / maxPrice : 1;
        score += Math.max(0, 20 - priceGapRatio * 20);

        const candidateBrand = (p.name.split(/\s+/)[0] || "").toLowerCase();
        if (currentBrand && candidateBrand && currentBrand === candidateBrand) score += 12;
        if (p.supplier && current.supplier && p.supplier === current.supplier) score += 8;

        return { ...p, recommendationScore: Number(score.toFixed(2)) };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 8);

    res.json({
      productId: current.id,
      basedOn: {
        category: current.category,
        price: current.price,
        supplier: current.supplier,
      },
      recommendations: ranked,
    });
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
    if (updated) {
      publishPriceChange({
        productId: updated.id,
        newPrice: updated.price,
        source: "manual",
        changedAt: new Date().toISOString(),
      });
    }
    res.json(updated);
  });

  /* ===== ORDERS ===== */
  app.post("/api/orders", async (req, res) => {
    const { productId, quantity, buyerName, buyerEmail, buyerPhone, deliveryAddress, paymentMethod } = req.body;
    if (!productId || !quantity || !buyerName || !buyerEmail)
      return res.status(400).json({ message: "Missing required fields" });

    const product = await storage.getProduct(Number(productId));
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stock < quantity)
      return res.status(400).json({ message: "Insufficient stock" });
    if (quantity < product.moq)
      return res.status(400).json({ message: `Minimum order quantity is ${product.moq}` });

    const addr = deliveryAddress && typeof deliveryAddress === "object" ? deliveryAddress : { street: "", area: "", district: "", country: "Lesotho" };
    if (!addr.street || !addr.area || !addr.district) {
      return res.status(400).json({ message: "Delivery address is required" });
    }
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const initialHistory = [{ status: "paid", label: "Order Placed", timestamp: new Date().toISOString(), note: `Payment method: ${normalizedPaymentMethod}` }];

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
          paymentMethod: normalizedPaymentMethod,
          status: "paid",
          deliveryAddress: addr,
          trackingHistory: initialHistory,
        }).returning();

        return createdOrder;
      });

      void pricing.stockChanged(product.id).catch((error) => {
        console.error("[Pricing Event] stockChanged failed:", error);
      });

      sendOrderConfirmationEmail({
        orderIds: [order.id],
        buyerName,
        buyerEmail,
        items: [
          {
            productName: product.name,
            quantity,
            unitPrice: product.price,
            image: product.image,
          },
        ],
        subtotal: order.totalPrice,
        shippingMethod: "Standard (Free)",
        shippingCost: 0,
        total: order.totalPrice,
        paymentMethod: normalizedPaymentMethod,
      }).catch((emailErr) => console.error("[Email] Background send failed:", emailErr));

      res.status(201).json(order);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/orders/checkout", async (req, res) => {
    const { items, buyerName, buyerEmail, buyerPhone, shippingMethod, deliveryAddress, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0 || !buyerName || !buyerEmail)
      return res.status(400).json({ message: "Missing required fields" });

    const addr = deliveryAddress && typeof deliveryAddress === "object" ? deliveryAddress : { street: "", area: "", district: "", country: "Lesotho" };
    if (!addr.street || !addr.area || !addr.district) {
      return res.status(400).json({ message: "Delivery address is required" });
    }
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const initialHistory = [{ status: "paid", label: "Order Placed", timestamp: new Date().toISOString(), note: `Payment method: ${normalizedPaymentMethod}` }];

    try {
      const createdOrders: any[] = [];
      const emailItems: { productName: string; quantity: number; unitPrice: number; image: string }[] = [];

      for (const item of items) {
        const product = await storage.getProduct(Number(item.productId));
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
        if (item.quantity < product.moq) throw new Error(`Minimum order quantity for ${product.name} is ${product.moq}`);

        const order = await db.transaction(async (tx) => {
          const [stockUpdated] = await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${item.quantity}` })
            .where(eq(products.id, product.id))
            .returning();

          if (!stockUpdated || stockUpdated.stock < 0)
            throw new Error(`Insufficient stock for ${product.name}`);

          const [createdOrder] = await tx.insert(orders).values({
            productId: product.id,
            sellerId: product.userId,
            buyerName,
            buyerEmail,
            buyerPhone: buyerPhone || "",
            quantity: item.quantity,
            unitPrice: product.price,
            totalPrice: product.price * item.quantity,
            paymentMethod: normalizedPaymentMethod,
            status: "paid",
            deliveryAddress: addr,
            trackingHistory: initialHistory,
          }).returning();

          return createdOrder;
        });

        createdOrders.push(order);
        emailItems.push({
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          image: product.image,
        });
      }

      const subtotal = createdOrders.reduce((sum, o) => sum + o.totalPrice, 0);
      const shippingCost = shippingMethod === "express" ? 150 : 0;
      const total = subtotal + shippingCost;
      const orderIds = createdOrders.map(o => o.id);

      const touchedProductIds = Array.from(new Set(items.map((item) => Number(item.productId)).filter((value) => Number.isFinite(value))));
      for (const touchedProductId of touchedProductIds) {
        void pricing.stockChanged(touchedProductId).catch((error) => {
          console.error("[Pricing Event] stockChanged failed:", error);
        });
      }

      sendOrderConfirmationEmail({
        orderIds,
        buyerName,
        buyerEmail,
        items: emailItems,
        subtotal,
        shippingMethod: shippingMethod === "express"
          ? "Express Delivery"
          : shippingMethod === "checkpoint"
            ? "Checkpoint Delivery"
            : "Standard (Free)",
        shippingCost,
        total,
        paymentMethod: normalizedPaymentMethod,
      }).catch(err => console.error("[Email] Background send failed:", err));

      res.status(201).json({ orderIds, total, itemCount: items.length });
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

  /* ===== ORDER TRACKING (public) ===== */
  app.get("/api/orders/track/:id", async (req, res) => {
    const id = Number(req.params.id);
    const email = ((req.query.email as string) || "").trim();
    if (!Number.isFinite(id) || id <= 0 || !email)
      return res.status(400).json({ message: "Order ID and email are required" });

    const order = await storage.getOrderByIdAndEmail(id, email);
    if (!order) return res.status(404).json({ message: "Order not found. Check your order number and email." });

    const product = await storage.getProduct(order.productId);
    res.json({
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      buyerName: order.buyerName,
      quantity: order.quantity,
      totalPrice: order.totalPrice,
      deliveryAddress: order.deliveryAddress,
      trackingHistory: order.trackingHistory ?? [],
      createdAt: order.createdAt,
      productName: product?.name ?? "Product",
      productImage: product?.image ?? "",
    });
  });

  app.get("/api/orders/history", async (req, res) => {
    const email = ((req.query.email as string) || "").trim();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const buyerOrders = await storage.getOrdersByBuyerEmail(email);
    if (buyerOrders.length === 0) {
      return res.json({ email, count: 0, orders: [] });
    }

    const productIds = Array.from(new Set(buyerOrders.map((o) => o.productId)));
    const productMap = new Map<number, Product>();
    await Promise.all(
      productIds.map(async (productId) => {
        const product = await storage.getProduct(productId);
        if (product) productMap.set(productId, product);
      }),
    );

    res.json({
      email,
      count: buyerOrders.length,
      orders: buyerOrders.map((order) => {
        const product = productMap.get(order.productId);
        return {
          id: order.id,
          status: order.status,
          paymentMethod: order.paymentMethod,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt,
          productId: order.productId,
          productName: product?.name ?? "Product",
          productImage: product?.image ?? "",
          trackingHistory: order.trackingHistory ?? [],
        };
      }),
    });
  });

  /* ===== CHECKPOINT UPDATE (seller + admin) ===== */
  app.post("/api/orders/:id/checkpoint", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const id = Number(req.params.id);
    const { status, label, note } = req.body;
    const validStatuses = ["paid", "processing", "in_transit", "at_checkpoint", "ready", "fulfilled", "cancelled"];
    if (!validStatuses.includes(status) || !label)
      return res.status(400).json({ message: "Invalid status or missing label" });

    const order = await storage.getOrderById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.user?.role !== "admin" && order.sellerId !== userId)
      return res.status(403).json({ message: "Not authorized" });

    const alreadyReady = Array.isArray(order.trackingHistory)
      ? order.trackingHistory.some((event: any) => event?.status === "ready")
      : false;

    const event = { status, label, timestamp: new Date().toISOString(), note: note || undefined };
    const updated = await storage.appendOrderTracking(id, event);

    if (status === "ready" && !alreadyReady) {
      const product = await storage.getProduct(order.productId);
      const trackUrl = `${req.protocol}://${req.get("host")}/track?orderId=${order.id}&email=${encodeURIComponent(order.buyerEmail)}`;
      sendOrderReadyForCollectionEmail({
        orderId: order.id,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        paymentMethod: normalizePaymentMethod(order.paymentMethod),
        productName: product?.name,
        collectionPoint: "LESonline collection point",
        trackUrl,
      }).catch((emailErr) => console.error("[Email] Ready email failed:", emailErr));
    }

    res.json(updated);
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { status } = req.body;
    if (!["paid", "processing", "ready", "fulfilled", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const isAdmin = req.user?.role === "admin";
    let updated;
    if (isAdmin) {
      updated = await storage.updateOrderStatusAdmin(Number(req.params.id), status);
    } else {
      updated = await storage.updateOrderStatus(Number(req.params.id), userId, status);
    }
    if (!updated) return res.status(404).json({ message: "Order not found" });

    const statusLabelMap: Record<string, string> = {
      paid: "Order Placed",
      processing: "Seller Processing",
      in_transit: "In Transit",
      at_checkpoint: "At Checkpoint",
      ready: "Ready for Pickup",
      fulfilled: "Delivered / Collected",
      cancelled: "Order Cancelled",
    };

    const checkpointLabel = statusLabelMap[status] || "Status Updated";
    const alreadyReady = Array.isArray(updated.trackingHistory)
      ? updated.trackingHistory.some((event: any) => event?.status === "ready")
      : false;

    const withTracking = await storage.appendOrderTracking(updated.id, {
      status,
      label: checkpointLabel,
      timestamp: new Date().toISOString(),
      note: `Updated by ${isAdmin ? "admin" : "seller"}`,
    });

    if (status === "ready" && !alreadyReady) {
      const product = await storage.getProduct(updated.productId);
      const trackUrl = `${req.protocol}://${req.get("host")}/track?orderId=${updated.id}&email=${encodeURIComponent(updated.buyerEmail)}`;
      sendOrderReadyForCollectionEmail({
        orderId: updated.id,
        buyerName: updated.buyerName,
        buyerEmail: updated.buyerEmail,
        paymentMethod: normalizePaymentMethod(updated.paymentMethod),
        productName: product?.name,
        collectionPoint: "LESonline collection point",
        trackUrl,
      }).catch((emailErr) => console.error("[Email] Ready email failed:", emailErr));
    }

    res.json(withTracking || updated);
  });

  /* ===== RECOMMENDATIONS ===== */
  app.get("/api/recommendations", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const recs = req.user?.role === "admin"
      ? await storage.getAllRecommendations()
      : await storage.getRecommendationsByUser(userId);
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
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.user?.role !== "admin" && product.userId !== userId)
      return res.status(404).json({ message: "Product not found" });

    const updated = await storage.updateProductPrice(product.id, price);
    if (updated) {
      publishPriceChange({
        productId: updated.id,
        newPrice: updated.price,
        source: req.user?.role === "admin" ? "admin" : "manual",
        changedAt: new Date().toISOString(),
      });
    }
    await storage.deleteRecommendation(Number(req.params.id));
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
    const result = await predict(product);

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
      const result = await predict(product);

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

    res.json({ generated: results.length, recommendations: results });
  });

  app.get("/api/price-updates/latest", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const latest = await storage.getLatestPriceUpdateLog();
    res.json(latest || null);
  });

  app.get("/api/price-updates/status", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    res.json(getSchedulerStatus());
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
    stats.forEach((s: any, cat: string) => {
      result[cat] = s;
    });
    res.json(result);
  });

  /* ===== MODEL INFO ===== */
  app.get("/api/model/info", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const info = getModelInfo();
    if (!info) return res.status(503).json({ message: "Model not initialized" });
    res.json(info);
  });

  /* ===== ANALYTICS (authenticated users) ===== */
  app.get("/api/analytics/overview", async (req, res) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const isAdmin = req.user?.role === "admin";

    const allProducts = isAdmin
      ? await storage.getAllProducts()
      : await storage.getProductsByUser(userId);

    const savedRecs = isAdmin
      ? await storage.getAllRecommendations()
      : await storage.getRecommendationsByUser(userId);

    const recommendations = savedRecs
      .map(r => ({
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        currentPrice: r.currentPrice,
        recommendedPrice: r.recommendedPrice,
        confidence: r.confidence,
        reason: r.reason,
        trend: r.trend,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));

    const stats = getAllCategoryStats();
    const categoryStatsObj: Record<string, any> = {};
    stats.forEach((s: any, cat: string) => {
      categoryStatsObj[cat] = s;
    });

    let ordersByCategory: Record<string, number> = {};
    let revenueByCategory: Record<string, number> = {};

    if (isAdmin) {
      const analytics = await storage.getAnalytics();
      for (const item of analytics.ordersByCategory) {
        ordersByCategory[item.category] = item.count;
        revenueByCategory[item.category] = item.revenue;
      }
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

  app.delete("/api/admin/users/:id", async (req, res) => {
    const adminId = requireAdmin(req, res);
    if (!adminId) return;
    const targetId = Number(req.params.id);
    if (targetId === adminId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const deleted = await storage.deleteUser(targetId);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ success: true });
  });

  app.post("/api/admin/pricing/run-all", async (req, res) => {
    const adminId = requireAdmin(req, res);
    if (!adminId) return;
    const allProducts = await storage.getAllProducts();
    // Keep one latest recommendation per product (do not wipe all)
    const changes: {
      productId: number;
      productName: string;
      category: string;
      previousPrice: number;
      newPrice: number;
      confidence: number;
      trend: string;
      reason: string;
    }[] = [];

    for (const product of allProducts) {
      const orderCount = await storage.getOrderCount(product.id);
      const result = await predict(product);

      // Replace old recommendation for this product with new one (keep owner's userId)
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

      const changePct = Math.abs(result.recommendedPrice - product.price) / product.price;
      if (changePct > 0.05) {
        await storage.updateProductPrice(product.id, result.recommendedPrice);

        changes.push({
          productId: product.id,
          productName: product.name,
          category: product.category,
          previousPrice: product.price,
          newPrice: result.recommendedPrice,
          confidence: result.confidence,
          trend: result.trend,
          reason: result.reason,
        });
      }
    }

    res.json({
      totalAnalyzed: allProducts.length,
      totalChanged: changes.length,
      changes,
    });
  });

  app.post("/api/admin/pricing/events/competitor", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const { productId, competitorPrice } = req.body;
    if (typeof productId !== "number" || typeof competitorPrice !== "number") {
      return res.status(400).json({ message: "productId and competitorPrice must be numbers" });
    }

    try {
      const outcome = await pricing.competitorPriceChanged(productId, competitorPrice);
      res.json(outcome);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to process competitor price event" });
    }
  });

  app.get("/api/admin/analytics", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const analytics = await storage.getAnalytics();
    res.json(analytics);
  });

  app.get("/api/admin/price-updates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const logs = await storage.getPriceUpdateLogs(20);
    res.json(logs);
  });

  app.get("/api/admin/price-updates/latest", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const latest = await storage.getLatestPriceUpdateLog();
    res.json(latest || null);
  });

  app.post("/api/admin/price-updates/run-now", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const result = await runAutoPriceUpdate();
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/competitor-prices/scrape-product", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const productId = Number(req.body?.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: "productId must be a positive number" });
    }

    const product = await storage.getProduct(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    try {
      const competitor = await getCompetitorPrices(product, { forceLiveScrape: true, allowLiveScrape: true });
      res.json({
        productId: product.id,
        productName: product.name,
        currentPrice: product.price,
        competitor,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to scrape competitor prices" });
    }
  });

  app.post("/api/admin/competitor-prices/scrape-now", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const limitRaw = Number(req.body?.limit ?? 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(50, Math.max(1, Math.floor(limitRaw)))
      : 10;

    const allProducts = await storage.getAllProducts();
    const selected = allProducts.slice(0, limit);

    const results: Array<{
      productId: number;
      productName: string;
      currentPrice: number;
      competitor?: {
        productId: number;
        query: string;
        source: "scraped" | "scraped-google";
        averagePrice: number;
        minPrice: number;
        maxPrice: number;
        matchCount: number;
        cached: boolean;
        matches: Array<{
          competitorName: string;
          productTitle: string;
          price: number;
          url: string;
          similarityScore: number;
        }>;
      };
      competitorPrice: number | null;
      competitorDelta: number | null;
      source: string;
      error?: string;
    }> = [];

    for (const product of selected) {
      try {
        const competitor = await getCompetitorPrices(product, { forceLiveScrape: true, allowLiveScrape: true });
        results.push({
          productId: product.id,
          productName: product.name,
          currentPrice: product.price,
          competitor,
          competitorPrice: competitor.averagePrice,
          competitorDelta: product.price - competitor.averagePrice,
          source: competitor.source,
        });
      } catch (error: any) {
        results.push({
          productId: product.id,
          productName: product.name,
          currentPrice: product.price,
          competitorPrice: null,
          competitorDelta: null,
          source: "error",
          error: error.message || "Competitor scrape failed",
        });
      }
    }

    res.json({
      requested: limit,
      processed: results.length,
      success: results.filter((r) => r.source !== "error").length,
      failed: results.filter((r) => r.source === "error").length,
      results,
    });
  });

  // ── Competitor price change history ──────────────────────────────────────────

  // Per-product: last N days of competitor price changes (accessible to the product owner)
  app.get("/api/competitor-prices/changes/:productId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });

    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ message: "productId must be a positive number" });
    }

    const product = await storage.getProduct(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const user = req.user as Express.User;
    if (product.userId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const days = Math.min(90, Math.max(1, Number(req.query.days ?? 7)));
    const changes = await getRecentCompetitorPriceChanges(productId, days);
    res.json({ productId, days, total: changes.length, changes });
  });

  // Admin: all competitor price changes across all products
  app.get("/api/admin/competitor-prices/changes", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const days = Math.min(90, Math.max(1, Number(req.query.days ?? 7)));
    const changes = await getAllRecentPriceChanges(days);

    // Group by competitor for summary
    const byCompetitor: Record<string, { increases: number; decreases: number; totalChanges: number }> = {};
    for (const c of changes) {
      if (!byCompetitor[c.competitorName]) {
        byCompetitor[c.competitorName] = { increases: 0, decreases: 0, totalChanges: 0 };
      }
      byCompetitor[c.competitorName].totalChanges += 1;
      if (c.direction === "increased") byCompetitor[c.competitorName].increases += 1;
      else if (c.direction === "decreased") byCompetitor[c.competitorName].decreases += 1;
    }

    res.json({ days, total: changes.length, byCompetitor, changes });
  });

  app.get("/api/admin/price-updates/status", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json(getSchedulerStatus());
  });

  app.get("/api/admin/pricing/system-state", async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const latestRun = await storage.getLatestPriceUpdateLog();
    res.json({
      timestamp: new Date().toISOString(),
      scheduler: getSchedulerStatus(),
      model: getModelInfo(),
      policy: pricing.getPricingPolicyConfig(),
      latestRun,
      emailDelivery: getEmailDeliveryStatus(),
    });
  });

  app.delete("/api/admin/price-updates/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await storage.deletePriceUpdateLog(Number(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Log not found" });
    res.json({ success: true });
  });

  app.delete("/api/admin/price-updates", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const count = await storage.deleteAllPriceUpdateLogs();
    res.json({ success: true, deleted: count });
  });

  return httpServer;
}

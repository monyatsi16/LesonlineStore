import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, jsonb, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  businessName: text("business_name").notNull(),
  role: text("role").notNull().default("retailer"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, role: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  price: real("price").notNull(),
  costPrice: real("cost_price").notNull().default(0),
  moq: integer("moq").notNull().default(1),
  supplier: text("supplier").notNull(),
  rating: real("rating").notNull().default(0),
  reviews: integer("reviews").notNull().default(0),
  image: text("image").notNull(),
  category: text("category").notNull(),
  specs: jsonb("specs").$type<Record<string, string>>().notNull().default({}),
  stock: integer("stock").notNull().default(0),
  description: text("description").notNull(),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerPhone: text("buyer_phone").notNull().default(""),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),
  paymentMethod: text("payment_method").notNull().default("cash_on_delivery"),
  status: text("status").notNull().default("paid"),
  deliveryAddress: jsonb("delivery_address").$type<{
    street: string;
    area: string;
    district: string;
    country: string;
  }>().default({ street: "", area: "", district: "", country: "Lesotho" }),
  trackingHistory: jsonb("tracking_history").$type<
    { status: string; label: string; timestamp: string; note?: string }[]
  >().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const priceRecommendations = pgTable("price_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  currentPrice: real("current_price").notNull(),
  recommendedPrice: real("recommended_price").notNull(),
  confidence: real("confidence").notNull(),
  reason: text("reason").notNull(),
  trend: text("trend").notNull().default("stable"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const salesData = pgTable("sales_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  month: text("month").notNull(),
  revenue: real("revenue").notNull(),
  orders: integer("orders").notNull(),
});

export const priceUpdateLogs = pgTable("price_update_logs", {
  id: serial("id").primaryKey(),
  runAt: timestamp("run_at").defaultNow(),
  productsAnalyzed: integer("products_analyzed").notNull(),
  productsUpdated: integer("products_updated").notNull(),
  totalPriceChanges: real("total_price_changes").notNull().default(0),
  status: text("status").notNull().default("completed"),
  details: jsonb("details").$type<{
    updates: { productId: number; productName: string; oldPrice: number; newPrice: number; confidence: number; trend: string }[];
    skipped: { productId: number; productName: string; currentPrice: number; recommendedPrice: number; confidence: number; changePct: number; skipReason: string }[];
  }>().notNull().default({ updates: [], skipped: [] }),
  nextRunAt: timestamp("next_run_at"),
});

export const insertPriceUpdateLogSchema = createInsertSchema(priceUpdateLogs).omit({ id: true, runAt: true });
export type PriceUpdateLog = typeof priceUpdateLogs.$inferSelect;
export type InsertPriceUpdateLog = z.infer<typeof insertPriceUpdateLogSchema>;

export const competitorPrices = pgTable("competitor_prices", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  competitorName: text("competitor_name"),
  productTitle: text("product_title"),
  price: real("price").notNull(),
  url: text("url"),
  similarityScore: real("similarity_score"),
  source: text("source").notNull().default("scraped"), // "scraped" | "catalogue" | "scraped-google"
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompetitorPriceSchema = createInsertSchema(competitorPrices).omit({ id: true, createdAt: true });
export type CompetitorPrice = typeof competitorPrices.$inferSelect;
export type InsertCompetitorPrice = z.infer<typeof insertCompetitorPriceSchema>;

// Tracks every time a competitor changes their price (increase or decrease)
export const competitorPriceHistory = pgTable("competitor_price_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  competitorName: text("competitor_name").notNull(),
  productTitle: text("product_title").notNull(),
  previousPrice: real("previous_price").notNull(),
  newPrice: real("new_price").notNull(),
  percentChange: real("percent_change").notNull(),
  direction: text("direction").notNull(), // "increased" | "decreased" | "stable"
  url: text("url"),
  source: text("source").notNull().default("scraped"),
  detectedAt: timestamp("detected_at").defaultNow(),
});

export const insertCompetitorPriceHistorySchema = createInsertSchema(competitorPriceHistory).omit({ id: true, detectedAt: true });
export type CompetitorPriceHistory = typeof competitorPriceHistory.$inferSelect;
export type InsertCompetitorPriceHistory = z.infer<typeof insertCompetitorPriceHistorySchema>;

export const insertProductSchema = createInsertSchema(products).omit({ id: true, views: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, status: true });
export const insertRecommendationSchema = createInsertSchema(priceRecommendations).omit({ id: true, createdAt: true });
export const insertSalesSchema = createInsertSchema(salesData).omit({ id: true });

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type PriceRecommendation = typeof priceRecommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type SalesData = typeof salesData.$inferSelect;
export type InsertSalesData = z.infer<typeof insertSalesSchema>;

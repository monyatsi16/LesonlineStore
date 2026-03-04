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
  status: text("status").notNull().default("pending"),
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

export const insertProductSchema = createInsertSchema(products).omit({ id: true, views: true });
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

import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  products,
  orders,
  priceRecommendations,
  salesData,
  type User,
  type InsertUser,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type PriceRecommendation,
  type InsertRecommendation,
  type SalesData,
  type InsertSalesData,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAllProducts(): Promise<Product[]>;
  getProductsByUser(userId: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByUser(id: number, userId: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductPrice(id: number, price: number): Promise<Product | undefined>;
  updateProductStock(id: number, quantity: number): Promise<Product | undefined>;
  incrementProductViews(id: number): Promise<void>;
  searchProducts(query: string): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrdersBySeller(sellerId: number): Promise<Order[]>;
  getOrdersByProduct(productId: number): Promise<Order[]>;
  updateOrderStatus(id: number, sellerId: number, status: string): Promise<Order | undefined>;
  getOrderCount(productId: number): Promise<number>;

  getRecommendationsByUser(userId: number): Promise<PriceRecommendation[]>;
  createRecommendation(rec: InsertRecommendation): Promise<PriceRecommendation>;
  deleteRecommendationByUser(id: number, userId: number): Promise<boolean>;

  getSalesDataByUser(userId: number): Promise<SalesData[]>;
  createSalesData(data: InsertSalesData): Promise<SalesData>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.id));
  }

  async getProductsByUser(userId: number): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.userId, userId));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByUser(id: number, userId: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.userId, userId)));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProductPrice(id: number, price: number): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ price })
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async updateProductStock(id: number, quantity: number): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ stock: sql`GREATEST(${products.stock} - ${quantity}, 0)` })
      .where(and(eq(products.id, id), sql`${products.stock} >= ${quantity}`))
      .returning();
    return updated;
  }

  async incrementProductViews(id: number): Promise<void> {
    await db.update(products).set({ views: sql`${products.views} + 1` }).where(eq(products.id, id));
  }

  async searchProducts(query: string): Promise<Product[]> {
    return await db.select().from(products).where(
      sql`LOWER(${products.name}) LIKE ${'%' + query.toLowerCase() + '%'} OR LOWER(${products.category}) LIKE ${'%' + query.toLowerCase() + '%'}`
    );
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.category, category));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async getOrdersBySeller(sellerId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.sellerId, sellerId)).orderBy(desc(orders.createdAt));
  }

  async getOrdersByProduct(productId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.productId, productId));
  }

  async updateOrderStatus(id: number, sellerId: number, status: string): Promise<Order | undefined> {
    const [updated] = await db
      .update(orders)
      .set({ status })
      .where(and(eq(orders.id, id), eq(orders.sellerId, sellerId)))
      .returning();
    return updated;
  }

  async getOrderCount(productId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.productId, productId));
    return Number(result[0]?.count || 0);
  }

  async getRecommendationsByUser(userId: number): Promise<PriceRecommendation[]> {
    return await db.select().from(priceRecommendations).where(eq(priceRecommendations.userId, userId));
  }

  async createRecommendation(rec: InsertRecommendation): Promise<PriceRecommendation> {
    const [created] = await db.insert(priceRecommendations).values(rec).returning();
    return created;
  }

  async deleteRecommendationByUser(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(priceRecommendations).where(and(eq(priceRecommendations.id, id), eq(priceRecommendations.userId, userId))).returning();
    return result.length > 0;
  }

  async getSalesDataByUser(userId: number): Promise<SalesData[]> {
    return await db.select().from(salesData).where(eq(salesData.userId, userId));
  }

  async createSalesData(data: InsertSalesData): Promise<SalesData> {
    const [created] = await db.insert(salesData).values(data).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();

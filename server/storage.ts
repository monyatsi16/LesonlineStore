import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  products,
  priceRecommendations,
  salesData,
  type User,
  type InsertUser,
  type Product,
  type InsertProduct,
  type PriceRecommendation,
  type InsertRecommendation,
  type SalesData,
  type InsertSalesData,
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProductsByUser(userId: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductByUser(id: number, userId: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductPrice(id: number, userId: number, price: number): Promise<Product | undefined>;

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

  async updateProductPrice(id: number, userId: number, price: number): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ price })
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning();
    return updated;
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

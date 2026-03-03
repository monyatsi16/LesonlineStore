import { eq } from "drizzle-orm";
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

  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductPrice(id: number, price: number): Promise<Product | undefined>;

  getRecommendations(): Promise<PriceRecommendation[]>;
  createRecommendation(rec: InsertRecommendation): Promise<PriceRecommendation>;
  deleteRecommendation(id: number): Promise<void>;

  getSalesData(): Promise<SalesData[]>;
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

  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
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

  async getRecommendations(): Promise<PriceRecommendation[]> {
    return await db.select().from(priceRecommendations);
  }

  async createRecommendation(rec: InsertRecommendation): Promise<PriceRecommendation> {
    const [created] = await db.insert(priceRecommendations).values(rec).returning();
    return created;
  }

  async deleteRecommendation(id: number): Promise<void> {
    await db.delete(priceRecommendations).where(eq(priceRecommendations.id, id));
  }

  async getSalesData(): Promise<SalesData[]> {
    return await db.select().from(salesData);
  }

  async createSalesData(data: InsertSalesData): Promise<SalesData> {
    const [created] = await db.insert(salesData).values(data).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();

import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  products,
  priceRecommendations,
  salesData,
  type Product,
  type InsertProduct,
  type PriceRecommendation,
  type InsertRecommendation,
  type SalesData,
  type InsertSalesData,
} from "@shared/schema";

export interface IStorage {
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

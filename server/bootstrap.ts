import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";
import { products, users } from "@shared/schema";
import { db } from "./db";
import seedData from "./seed-data.json" with { type: "json" };

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function ensureUser(params: {
  email: string;
  password: string;
  name: string;
  businessName: string;
  role: "admin" | "retailer";
}): Promise<number> {
  const existing = await db.select().from(users).where(eq(users.email, params.email));
  if (existing.length > 0) {
    return existing[0].id;
  }

  const hashedPassword = await hashPassword(params.password);
  const [created] = await db.insert(users).values({
    email: params.email,
    password: hashedPassword,
    name: params.name,
    businessName: params.businessName,
    role: params.role,
  }).returning();

  return created.id;
}

export async function ensureLesOnlineBootstrap(): Promise<void> {
  const adminId = await ensureUser({
    email: "admin@lesonline.co.ls",
    password: "LesOnlineAdmin2024!",
    name: "LesOnline Admin",
    businessName: "LesOnline Platform",
    role: "admin",
  });

  const sellerId = await ensureUser({
    email: "store@lesonline.co.ls",
    password: "LesOnline2024!",
    name: "LesOnline",
    businessName: "LesOnline",
    role: "retailer",
  });

  const existingSellerProducts = await db.select().from(products).where(eq(products.userId, sellerId));
  if (existingSellerProducts.length > 0) {
    console.log(
      `[Bootstrap] Ready: admin=${adminId}, seller=${sellerId}, products=${existingSellerProducts.length}`,
    );
    return;
  }

  console.log(`[Bootstrap] Empty catalog detected. Seeding ${seedData.length} LesOnline products...`);

  const batchSize = 50;
  for (let index = 0; index < seedData.length; index += batchSize) {
    const batch = seedData.slice(index, index + batchSize).map((item) => ({
      userId: sellerId,
      name: item.name,
      price: item.price,
      costPrice: Number(
        (
          typeof item.costPrice === "number" && item.costPrice > 0
            ? item.costPrice
            : item.price * 0.97
        ).toFixed(2),
      ),
      category: item.category,
      image: item.image,
      stock: item.stock,
      moq: item.moq,
      supplier: "LesOnline",
      rating: 0,
      reviews: 0,
      description: `${item.name} — Available on LesOnline, Lesotho's online marketplace. All prices in LSL (Maloti).`,
      specs: {},
    }));

    await db.insert(products).values(batch);
  }

  console.log(`[Bootstrap] Seeded catalog with ${seedData.length} products for seller ${sellerId}.`);
}
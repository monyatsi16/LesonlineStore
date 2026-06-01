import "dotenv/config";
import { db } from "./db";
import { users, products } from "@shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import seedData from "./seed-data.json" with { type: "json" };

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  console.log("Starting LesOnline database seed...");

  const existingAdmin = await db.select().from(users).where(eq(users.email, "admin@lesonline.co.ls"));
  if (existingAdmin.length === 0) {
    const adminPassword = await hashPassword("LesOnlineAdmin2024!");
    await db.insert(users).values({
      email: "admin@lesonline.co.ls",
      password: adminPassword,
      name: "LesOnline Admin",
      businessName: "LesOnline Platform",
      role: "admin",
    });
    console.log("Created admin account (admin@lesonline.co.ls)");
  } else {
    console.log("Admin account already exists");
  }

  const existing = await db.select().from(users).where(eq(users.email, "store@lesonline.co.ls"));
  let sellerId: number;

  if (existing.length === 0) {
    const hashedPassword = await hashPassword("LesOnline2024!");
    const [newSeller] = await db.insert(users).values({
      email: "store@lesonline.co.ls",
      password: hashedPassword,
      name: "LesOnline Store",
      businessName: "LesOnline",
      role: "retailer",
    }).returning();
    sellerId = newSeller.id;
    console.log(`Created LesOnline seller account (ID: ${sellerId})`);
  } else {
    sellerId = existing[0].id;
    console.log(`Using existing LesOnline seller (ID: ${sellerId})`);
  }

  const existingProducts = await db.select().from(products).where(eq(products.userId, sellerId));
  if (existingProducts.length > 0) {
    console.log(`Seller already has ${existingProducts.length} products. Skipping seed.`);
    console.log("To re-seed, delete existing products first.");
    process.exit(0);
  }

  console.log(`Inserting ${seedData.length} products...`);

  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < seedData.length; i += batchSize) {
    const batch = seedData.slice(i, i + batchSize).map((item) => ({
      userId: sellerId,
      name: item.name,
      price: item.price,
      // Persist source/manufacturer cost when available, otherwise use 3% fallback.
      costPrice: Number(
        (
          typeof item.costPrice === "number" && item.costPrice > 0
            ? item.costPrice
            : item.price * 0.97
        ).toFixed(2)
      ),
      category: item.category,
      image: item.image,
      stock: item.stock,
      moq: item.moq,
      supplier: "LesOnline",
      rating: 0,
      reviews: 0,
      description: `${item.name} — Available from LesOnline, Lesotho's home appliance marketplace. All prices in LSL (Maloti).`,
      specs: {},
    }));

    await db.insert(products).values(batch);
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${seedData.length}`);
  }

  console.log(`\nSeed complete! ${inserted} real LesOnline products added.`);
  console.log("Login: store@lesonline.co.ls / LesOnline2024!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

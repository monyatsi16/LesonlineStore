import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { products, priceRecommendations, salesData } from "@shared/schema";

neonConfig.webSocketConstructor = ws;

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });

  const existingProducts = await db.select().from(products);
  if (existingProducts.length > 0) {
    console.log("Database already seeded. Skipping.");
    await pool.end();
    return;
  }

  console.log("Seeding database...");

  const insertedProducts = await db.insert(products).values([
    {
      name: "Smeg 90cm Black Ceramic Electric Hob - SE495ETD",
      price: 15500.0,
      moq: 1,
      supplier: "Smeg Official",
      rating: 4.9,
      reviews: 42,
      image: "https://lesonline.store/cdn/shop/files/5tvn5vzg.png?v=1753355592&width=533",
      category: "Built-in Hobs",
      specs: { Size: "90cm", Material: "Black Ceramic", Type: "Electric Hob", Brand: "Smeg" },
      stock: 12,
      description: "Premium Smeg 90cm black ceramic electric hob with multicooking technology.",
    },
    {
      name: "Whirlpool 60cm Glass Hob - AKT8090/NE",
      price: 4500.0,
      moq: 1,
      supplier: "Whirlpool Authorized",
      rating: 4.7,
      reviews: 28,
      image: "https://lesonline.store/cdn/shop/files/ff3vyxzo.png?v=1697570992&width=533",
      category: "Built-in Hobs",
      specs: { Size: "60cm", Material: "Glass", Brand: "Whirlpool" },
      stock: 25,
      description: "Sleek Whirlpool 60cm glass hob for modern kitchens.",
    },
    {
      name: "DEFY-COMBINATION HOB - DHG605",
      price: 6500.0,
      moq: 1,
      supplier: "Defy Store",
      rating: 4.8,
      reviews: 56,
      image: "https://lesonline.store/cdn/shop/files/WhatsAppImage2023-06-26at19.08.28.jpg?v=1691657007&width=533",
      category: "Built-in Hobs",
      specs: { Brand: "Defy", Type: "Combination", Model: "DHG605" },
      stock: 18,
      description: "Versatile Defy combination hob with gas and electric burners.",
    },
    {
      name: "AEG 60cm Touch Control Ceramic Hob - HRB64600CB",
      price: 4250.0,
      moq: 1,
      supplier: "AEG Lesotho",
      rating: 4.6,
      reviews: 15,
      image: "https://lesonline.store/cdn/shop/products/AP105636-1.webp?v=1678805439&width=533",
      category: "Built-in Hobs",
      specs: { Brand: "AEG", Control: "Touch", Size: "60cm" },
      stock: 8,
      description: "High-performance AEG ceramic hob with precise touch control.",
    },
    {
      name: "Siemens iQ700 90cm Black Gas on Glass Hob",
      price: 19500.0,
      moq: 1,
      supplier: "Siemens Premium",
      rating: 5.0,
      reviews: 10,
      image: "https://lesonline.store/cdn/shop/files/mnrad76o.png?v=1769070854&width=533",
      category: "Built-in Hobs",
      specs: { Brand: "Siemens", Type: "Gas on Glass", Series: "iQ700" },
      stock: 5,
      description: "Top-tier Siemens iQ700 gas on glass hob for professional-grade home cooking.",
    },
  ]).returning();

  await db.insert(priceRecommendations).values([
    {
      productId: insertedProducts[0].id,
      productName: "Smeg 90cm Black Ceramic Electric Hob",
      currentPrice: 15500.0,
      recommendedPrice: 14850.0,
      confidence: 0.92,
      reason: "Gradient Boosting: Competitor stock surplus detected. Negative residual to maintain market share.",
      trend: "down",
    },
    {
      productId: insertedProducts[1].id,
      productName: "Whirlpool 60cm Glass Hob",
      currentPrice: 4500.0,
      recommendedPrice: 4725.0,
      confidence: 0.85,
      reason: "Gradient Boosting: High demand for compact hobs. Positive demand residual.",
      trend: "up",
    },
    {
      productId: insertedProducts[4].id,
      productName: "Siemens iQ700 90cm Gas on Glass Hob",
      currentPrice: 19500.0,
      recommendedPrice: 20100.0,
      confidence: 0.95,
      reason: "Gradient Boosting: Premium segment growth residual. Competitor prices rising.",
      trend: "up",
    },
  ]);

  await db.insert(salesData).values([
    { month: "Jan", revenue: 45000, orders: 24 },
    { month: "Feb", revenue: 38000, orders: 19 },
    { month: "Mar", revenue: 52000, orders: 31 },
    { month: "Apr", revenue: 47800, orders: 29 },
    { month: "May", revenue: 61000, orders: 38 },
    { month: "Jun", revenue: 55900, orders: 34 },
    { month: "Jul", revenue: 69500, orders: 43 },
  ]);

  console.log("Database seeded successfully!");
  await pool.end();
}

seed().catch(console.error);

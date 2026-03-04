import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { users } from "@shared/schema";

neonConfig.webSocketConstructor = ws;

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });

  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("Database already has users. No seeding needed.");
    console.log("Each business gets demo products when they register.");
    await pool.end();
    return;
  }

  console.log("Database is ready. Register a business through the app to get started.");
  console.log("Demo products and sales data are created automatically on registration.");
  await pool.end();
}

seed().catch(console.error);

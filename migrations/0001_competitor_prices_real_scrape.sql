CREATE TABLE IF NOT EXISTS "competitor_prices" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "competitor_name" text,
  "product_title" text,
  "price" real NOT NULL,
  "url" text,
  "similarity_score" real,
  "source" text DEFAULT 'simulated' NOT NULL,
  "timestamp" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD COLUMN IF NOT EXISTS "competitor_name" text;
--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD COLUMN IF NOT EXISTS "product_title" text;
--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD COLUMN IF NOT EXISTS "url" text;
--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD COLUMN IF NOT EXISTS "similarity_score" real;
--> statement-breakpoint
ALTER TABLE "competitor_prices" ADD COLUMN IF NOT EXISTS "timestamp" timestamp DEFAULT now();

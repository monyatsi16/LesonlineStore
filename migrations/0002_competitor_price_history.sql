-- Migration: Add competitor_price_history table
-- Tracks every time a competitor increases or decreases their price
-- so the dynamic pricing engine can react to market movements.

CREATE TABLE IF NOT EXISTS "competitor_price_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "competitor_name" text NOT NULL,
  "product_title" text NOT NULL,
  "previous_price" real NOT NULL,
  "new_price" real NOT NULL,
  "percent_change" real NOT NULL,
  "direction" text NOT NULL,           -- 'increased' | 'decreased' | 'stable'
  "url" text,
  "source" text NOT NULL DEFAULT 'scraped',
  "detected_at" timestamp DEFAULT now()
);

-- Index for fast per-product lookups
CREATE INDEX IF NOT EXISTS "idx_cph_product_id" ON "competitor_price_history" ("product_id");

-- Index for time-range queries (dashboard: "last 7 days")
CREATE INDEX IF NOT EXISTS "idx_cph_detected_at" ON "competitor_price_history" ("detected_at");

-- Update default source on existing competitor_prices rows that say 'simulated'
-- to 'catalogue' since they came from the static catalogue, not simulation.
UPDATE "competitor_prices"
SET "source" = 'catalogue'
WHERE "source" = 'simulated' AND "competitor_name" != 'simulated-market';

-- Delete purely fake simulated rows so old fake data doesn't pollute metrics
DELETE FROM "competitor_prices" WHERE "source" = 'simulated';

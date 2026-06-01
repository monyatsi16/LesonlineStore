CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_phone" text DEFAULT '' NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" real NOT NULL,
	"total_price" real NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"current_price" real NOT NULL,
	"recommended_price" real NOT NULL,
	"confidence" real NOT NULL,
	"reason" text NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_update_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_at" timestamp DEFAULT now(),
	"products_analyzed" integer NOT NULL,
	"products_updated" integer NOT NULL,
	"total_price_changes" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"details" jsonb DEFAULT '{"updates":[],"skipped":[]}'::jsonb NOT NULL,
	"next_run_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" real NOT NULL,
	"cost_price" real DEFAULT 0 NOT NULL,
	"moq" integer DEFAULT 1 NOT NULL,
	"supplier" text NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"image" text NOT NULL,
	"category" text NOT NULL,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sales_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"month" text NOT NULL,
	"revenue" real NOT NULL,
	"orders" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"business_name" text NOT NULL,
	"role" text DEFAULT 'retailer' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

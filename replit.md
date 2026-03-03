# LESonline.Store - Dynamic Pricing System

## Overview
A full-stack B2B e-commerce platform for Lesotho (LESonline.Store) featuring a Gradient Boosting pricing model for retailers. Built as an academic project demonstrating dynamic pricing algorithms.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter (frontend), Express (API)
- **State**: TanStack React Query
- **Currency**: Lesotho Loti (LSL/M)

## Architecture
```
client/src/
  pages/         - Home, Dashboard, ProductDetails, Cart
  components/    - Navbar, Hero, ProductCard
  lib/           - queryClient, pricingModel
server/
  index.ts       - Express server entry
  routes.ts      - API routes (/api/*)
  storage.ts     - Database CRUD (IStorage interface)
  db.ts          - Drizzle + Neon Serverless connection
  seed.ts        - Database seeder
shared/
  schema.ts      - Drizzle schema (products, price_recommendations, sales_data)
```

## API Routes
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PATCH /api/products/:id/price` - Update product price
- `GET /api/recommendations` - List pricing recommendations
- `POST /api/recommendations` - Create recommendation
- `DELETE /api/recommendations/:id` - Remove recommendation
- `POST /api/recommendations/:id/apply` - Apply recommendation (updates price + removes rec)
- `GET /api/sales` - Get sales data
- `POST /api/pricing/predict` - Run Gradient Boosting prediction

## Database Tables
- `products` - Product catalog (from lesonline.store)
- `price_recommendations` - Gradient Boosting model outputs
- `sales_data` - Monthly sales metrics

## Key Features
- Real product data from LESonline.Store (built-in hobs, appliances)
- Gradient Boosting pricing engine with 3 weak learners (Demand, Inventory, Competition)
- Retailer dashboard with live charts and model recommendations
- All prices in Lesotho Maloti (M)

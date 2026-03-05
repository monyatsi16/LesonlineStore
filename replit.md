# LesOnline — Alibaba Clone for Lesotho

## Overview
A full-stack multi-tenant marketplace AND dynamic pricing platform for e-commerce businesses in Lesotho (Alibaba Clone). Built for LesOnline (lesonline.store). Features 331 real products scraped from the LesOnline store, a real 5-tree Gradient Boosting pricing model trained on Lesotho market data, and full buyer/seller flows. All prices in Lesotho Maloti (LSL/M).

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js (Node.js) + Passport.js (session auth)
- **Database**: PostgreSQL with Drizzle ORM (@neondatabase/serverless driver)
- **AI Model**: Custom Gradient Boosting (5 decision trees, learning rate 0.3)
- **Routing**: Wouter (frontend), Express (API)
- **State**: TanStack React Query
- **Currency**: Lesotho Loti (LSL/M)

## Architecture
```
client/src/
  pages/         - Home (marketplace), Dashboard (seller), Auth, ProductDetails, Cart
  components/    - Navbar, Hero, ui/
  hooks/         - useAuth.ts
  lib/           - queryClient
server/
  index.ts       - Express server entry
  routes.ts      - API routes (public marketplace + auth-protected seller routes)
  storage.ts     - Database CRUD (IStorage interface)
  auth.ts        - Passport.js auth (no demo seeding)
  db.ts          - Drizzle + Neon serverless connection
  seed.ts        - Database seeder (331 real LesOnline products)
  seed-data.json - Scraped product data from lesonline.store
  pricing-model.ts - Real Gradient Boosting model (5 trees, category-aware)
shared/
  schema.ts      - Drizzle schema (users, products, orders, price_recommendations, sales_data)
```

## Pricing Model (server/pricing-model.ts)
- **Type**: Gradient Boosting Regression with 5 decision trees
- **Learning Rate**: 0.3
- **Training Data**: 331 products from lesonline.store across 15 categories
- **Features**: price position in category, price-to-mean ratio, price-to-median ratio, stock level, demand score, view score, conversion rate, category premium
- **Tree 1**: Demand + inventory interaction
- **Tree 2**: Category price positioning (above/below market average)
- **Tree 3**: Inventory scarcity/surplus signals
- **Tree 4**: View-to-order conversion analysis
- **Tree 5**: Competitive position + category premium
- **Output**: Recommended price, confidence (0.60–0.97), trend (up/down/stable), detailed reasoning

## Scraped Categories (15)
Built-in Hobs, Built-in Ovens, Dishwashers & Washing Machines, Fridge & Freezer, Range Hoods, Microwaves, Stoves, Fireplaces, Kitchen Sinks & Mixers, Bathroom, Geysers, Chairs, Phones, Men's Shoes, Men's Casual Shoes

## API Routes

### Public (no auth)
- `GET /api/marketplace` - All marketplace products
- `GET /api/marketplace/search?q=` - Search products
- `GET /api/marketplace/category/:category` - Filter by category
- `GET /api/marketplace/product/:id` - Product detail (increments views)
- `POST /api/orders` - Place order (buyer-facing, DB transaction)
- `GET /api/market/categories` - Category statistics from model
- `GET /api/market/insights/:category` - Category pricing insights

### Auth Required (seller dashboard)
- `POST /api/auth/register` - Register new business
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Current user
- `GET /api/products` - Seller's products
- `POST /api/products` - Add product
- `PATCH /api/products/:id/price` - Update price
- `GET /api/recommendations` - Pricing recommendations
- `POST /api/recommendations/:id/apply` - Apply recommendation
- `DELETE /api/recommendations/:id` - Delete recommendation
- `GET /api/sales` - Seller's sales data
- `POST /api/pricing/predict` - Run model on single product
- `POST /api/pricing/run-model` - Run model on all products
- `GET /api/orders/seller` - Seller's received orders
- `PATCH /api/orders/:id/status` - Update order status

## Database Seeding
- Run `npx tsx server/seed.ts` to seed 331 real LesOnline products
- Login: store@lesonline.co.ls / LesOnline2024!

## Key Features
- 331 real products scraped from lesonline.store
- Real 5-tree Gradient Boosting pricing model trained on Lesotho market data
- Public marketplace with search and category filters
- Product detail pages with order forms (no login required for buyers)
- Seller dashboard with orders, analytics, product management
- DB transactions for atomic stock decrement + order creation
- Multi-tenant isolation with ownership checks
- All prices in Lesotho Maloti (M)

# LesOnline — Smart Marketplace for Lesotho

## Overview
A full-stack multi-tenant marketplace AND dynamic pricing platform for e-commerce businesses in Lesotho. Built for LesOnline (lesonline.store). Features 331 real products scraped from the LesOnline store, a real 5-tree Gradient Boosting pricing model trained on Lesotho market data, admin dashboard, analytics, and full buyer/seller flows. All prices in Lesotho Maloti (LSL/M).

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
  pages/         - Home, Dashboard, AdminDashboard, Analytics, Auth, ProductDetails, Cart
  components/    - Navbar, Hero, ui/
  hooks/         - useAuth.ts
  lib/           - queryClient
server/
  index.ts       - Express server entry
  routes.ts      - API routes (public + seller + admin)
  storage.ts     - Database CRUD (IStorage interface)
  auth.ts        - Passport.js auth
  db.ts          - Drizzle + Neon serverless connection
  seed.ts        - Database seeder (331 products + admin account)
  seed-data.json - Scraped product data from lesonline.store
  pricing-model.ts - Real Gradient Boosting model (5 trees, category-aware)
shared/
  schema.ts      - Drizzle schema (users, products, orders, price_recommendations, sales_data)
```

## User Roles
- **admin**: Full platform management (admin@lesonline.co.ls / LesOnlineAdmin2024!)
- **retailer**: Seller dashboard, product management, pricing (store@lesonline.co.ls / LesOnline2024!)
- **buyer**: No account needed — browse, search, order directly

## Pages
- `/` — Home: marketplace with categories, search, sort, trending products
- `/auth` — Login/Register for sellers
- `/dashboard` — Seller dashboard: products, orders, pricing model, sales charts
- `/admin` — Admin dashboard: platform stats, user/product/order management, analytics charts, run pricing on all products
- `/analytics` — Pricing analytics: price distributions, market insights, demand analysis, category comparison
- `/product/:id` — Product detail with order form and add-to-cart
- `/cart` — Shopping cart with multi-item checkout

## Pricing Model (server/pricing-model.ts)
- **Type**: Gradient Boosting Regression with 5 decision trees
- **Learning Rate**: 0.3
- **Training Data**: 331 products from lesonline.store across 15 categories
- **Features**: price position in category, price-to-mean ratio, price-to-median ratio, stock level, demand score, view score, conversion rate, category premium
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

### Auth Required (seller)
- `GET/POST /api/products` - Seller's products
- `PATCH /api/products/:id/price` - Update price
- `GET/POST/DELETE /api/recommendations` - Pricing recommendations
- `POST /api/recommendations/:id/apply` - Apply recommendation
- `GET /api/sales` - Seller's sales data
- `POST /api/pricing/predict` - Run model on single product
- `POST /api/pricing/run-model` - Run model on all seller products
- `GET /api/orders/seller` - Seller's received orders
- `PATCH /api/orders/:id/status` - Update order status
- `GET /api/analytics/overview` - Analytics data

### Admin Only
- `GET /api/admin/stats` - Platform-wide stats
- `GET /api/admin/users` - All users
- `GET /api/admin/products` - All products
- `GET /api/admin/orders` - All orders
- `DELETE /api/admin/products/:id` - Remove any product
- `PATCH /api/admin/users/:id/role` - Change user role
- `POST /api/admin/pricing/run-all` - Run pricing model on all products
- `GET /api/admin/analytics` - Revenue/order analytics

## Database Seeding
- Run `npx tsx server/seed.ts` to seed 331 real LesOnline products + admin account
- Admin: admin@lesonline.co.ls / LesOnlineAdmin2024!
- Seller: store@lesonline.co.ls / LesOnline2024!

## Key Features
- 331 real products scraped from lesonline.store
- Real 5-tree Gradient Boosting pricing model trained on Lesotho market data
- Admin dashboard with platform-wide management and analytics
- Dynamic pricing analytics with charts and market insights
- Public marketplace with categories, search, sort, and trending
- Shopping cart with multi-item checkout
- Product detail pages with order forms (no login required for buyers)
- Seller dashboard with orders, analytics, product management
- DB transactions for atomic stock decrement + order creation
- Role-based access control (admin, retailer, buyer)
- All prices in Lesotho Maloti (M)

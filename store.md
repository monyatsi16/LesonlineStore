# LesOnline — Smart Marketplace for Lesotho

## Overview
A full-stack multi-tenant marketplace AND dynamic pricing platform for e-commerce businesses in Lesotho. Built for LesOnline (lesonline.store). Features 346 real products scraped from the LesOnline store, a real 6-tree Gradient Boosting pricing model (5 market + 1 brand-aware) trained on Lesotho market data, admin dashboard, analytics, and full buyer/seller flows. All prices in Lesotho Maloti (LSL/M).

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js (Node.js) + Passport.js (session auth)
- **Database**: PostgreSQL with Drizzle ORM (@neondatabase/serverless driver)
- **AI Model**: Custom Gradient Boosting (6 decision trees — 5 market + 1 brand, learning rate 0.3)
- **Routing**: Wouter (frontend), Express (API)
- **State**: TanStack React Query
- **Currency**: Lesotho Loti (LSL/M)

## Architecture
```
client/src/
pages/ - Home, Dashboard, AdminDashboard, Analytics, Auth, ProductDetails, Cart
components/ - Navbar, Hero, ui/
hooks/ - useAuth.ts
lib/ - queryClient
server/
index.ts - Express server entry
routes.ts - API routes (public + seller + admin)
storage.ts - Database CRUD (IStorage interface)
auth.ts - Passport.js auth
db.ts - Drizzle + Neon serverless connection
seed.ts - Database seeder (346 products + admin account)
seed-data.json - Scraped product data from lesonline.store
pricing-model.ts - Real Gradient Boosting model (6 trees, category + brand aware)
price-scheduler.ts - Automatic 2-days pricing cycle
shared/
schema.ts - Drizzle schema (users, products, orders, price_recommendations, sales_data, price_update_logs)
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
- **Type**: Gradient Boosting Regression with 6 decision trees (5 market + 1 brand)
- **Learning Rate**: 0.3
- **Training Data**: 346 products from lesonline.store across 18 categories, 65+ known brands, brand-category combos
- **Features**: price position in category, price-to-mean ratio, price-to-median ratio, price-to-brand-mean ratio, price-to-brand-median ratio, brand premium in category, stock level, demand score, view score, conversion rate, category premium
- **Brand-aware**: Extracts manufacturer from product name (Smeg, Bosch, Siemens, Bass Weejuns, Nike, Samsung, etc.) using word-boundary matching and longest-match-first. Brand tree (Tree 6) only fires when sufficient brand data exists (3+ brand-category or 5+ brand overall).
- **Output**: Recommended price, confidence (0.60–0.98), trend (up/down/stable), brand tag, detailed plain-English reasoning with brand/category/demand/stock/conversion explanations

## Scraped Categories (18)
Built-in Hobs, Built-in Ovens, Microwaves, Stoves, Gas Cooktops, Range Hoods, Kitchen Sinks & Mixers, Dishwashers & Washing Machines, Fridge & Freezer, Refrigerators, Ovens, Fireplaces, Geysers, Bathroom, Chairs, Men's Casual Shoes, Men's Shoes, Phones

## Automatic Price Updates (server/price-scheduler.ts)
- **Cycle**: Every 1 minute, the Gradient Boosting model automatically runs on all products
- **Behavior**: Analyzes order data, views, stock, and market position; auto-applies price changes where confidence >= 70% and change > 1%
- **Timer**: Uses a 1-minute `setInterval` scheduler loop with run locking to prevent overlap
- **Concurrency Guard**: Only one update can run at a time (manual or scheduled)
- **Persistence**: Logs every run to `price_update_logs` table with full details of which products changed
- **Admin Controls**: "Run Now" button, update history, scheduler status, latest price changes — all in the "Price Updates" tab
- **On startup**: Reads last log to determine next run time; if overdue, runs immediately

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
- `GET /api/admin/price-updates` - Price update history
- `GET /api/admin/price-updates/latest` - Latest price update log
- `POST /api/admin/price-updates/run-now` - Trigger manual price update (resets 4-week timer)
- `GET /api/admin/price-updates/status` - Live scheduler status

## Database Seeding
- Run `npx tsx server/seed.ts` to seed 346 real LesOnline products + admin account
- Admin: admin@lesonline.co.ls / LesOnlineAdmin2024!
- Seller: store@lesonline.co.ls / LesOnline2024!

## Key Features
- 346 real products scraped from lesonline.store
- Real 6-tree Gradient Boosting pricing model with brand-aware analysis (65+ brands)
- Admin dashboard with platform-wide management and analytics
- Dynamic pricing analytics with charts and market insights
- Public marketplace with categories, search, sort, and trending
- Shopping cart with multi-item checkout
- Product detail pages with order forms (no login required for buyers)
- Seller dashboard with orders, analytics, product management
- Automatic 4-week pricing cycle with concurrency guard and full logging
- DB transactions for atomic stock decrement + order creation
- Role-based access control (admin, retailer, buyer)
- All prices in Lesotho Maloti (M)
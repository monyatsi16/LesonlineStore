# SmartPrice — Lesotho's Smart Marketplace

## Overview
A full-stack multi-tenant marketplace AND dynamic pricing platform for e-commerce businesses in Lesotho (like Alibaba). Sellers list products publicly, buyers browse and place orders, and real transaction data automatically feeds a Gradient Boosting pricing model. All prices in Lesotho Maloti (LSL/M).

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js (Node.js) + Passport.js (session auth)
- **Database**: PostgreSQL with Drizzle ORM (@neondatabase/serverless driver)
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
  auth.ts        - Passport.js auth + demo data seeding on register
  db.ts          - Drizzle + Neon serverless connection
  seed.ts        - Database seeder
shared/
  schema.ts      - Drizzle schema (users, products, price_recommendations, sales_data, orders)
```

## Multi-Tenancy
- All data tables have a `userId` foreign key for seller isolation
- Public marketplace routes show all products (no auth required)
- Seller dashboard routes filter by `req.user.id`
- New registrations auto-seed 5 demo products + 7 months of sales data
- Ownership checks on all mutations (getProductByUser, deleteRecommendationByUser)

## API Routes

### Public (no auth)
- `GET /api/marketplace` - All marketplace products with seller names
- `GET /api/marketplace/search?q=` - Search products
- `GET /api/marketplace/product/:id` - Product detail (increments views)
- `POST /api/orders` - Place order (buyer-facing)

### Auth Required (seller dashboard)
- `POST /api/auth/register` - Register new business
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/user` - Current user
- `GET /api/products` - Seller's products
- `POST /api/products` - Add product
- `GET /api/recommendations` - Seller's pricing recommendations
- `POST /api/recommendations/:id/apply` - Apply recommendation
- `GET /api/sales` - Seller's sales data
- `POST /api/pricing/run-model` - Run Gradient Boosting model
- `GET /api/orders/seller` - Seller's received orders
- `PATCH /api/orders/:id/status` - Update order status

## Database Tables
- `users` - Business accounts (name, email, password, businessName)
- `products` - Product catalog (userId FK, views count, stock, specs JSON)
- `price_recommendations` - Gradient Boosting outputs (userId FK)
- `sales_data` - Monthly revenue metrics (userId FK)
- `orders` - Marketplace orders (productId, sellerId, buyer info, quantity, status)

## Key Features
- Public marketplace homepage with search and category filters
- Product detail pages with order forms
- Seller dashboard with orders, analytics, product management
- Gradient Boosting pricing engine using real order data (order count, views, stock)
- Multi-tenant isolation with ownership checks
- All prices in Lesotho Maloti (M)
- Demo data automatically seeded on registration

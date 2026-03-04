# SmartPrice - Dynamic Pricing Platform for Lesotho

## Overview
A full-stack multi-tenant dynamic pricing platform for all e-commerce businesses in Lesotho. Each business registers their own account and gets an isolated dashboard with their products, sales analytics, and AI-powered price recommendations using a Gradient Boosting model. All prices in Lesotho Maloti (LSL/M).

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express.js (Node.js) + Passport.js (session auth)
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter (frontend), Express (API)
- **State**: TanStack React Query
- **Currency**: Lesotho Loti (LSL/M)

## Architecture
```
client/src/
  pages/         - Home, Dashboard, Auth
  components/    - Navbar, Hero, ui/
  hooks/         - useAuth.ts
  lib/           - queryClient
server/
  index.ts       - Express server entry
  routes.ts      - API routes (/api/*)
  storage.ts     - Database CRUD (IStorage interface)
  auth.ts        - Passport.js auth + demo data seeding on register
  db.ts          - Drizzle + pg connection
  seed.ts        - Database seeder (minimal, users self-seed on register)
shared/
  schema.ts      - Drizzle schema (users, products, price_recommendations, sales_data)
```

## Multi-Tenancy
- All data tables (products, price_recommendations, sales_data) have a `userId` foreign key
- API routes filter all queries by `req.user.id`
- New registrations auto-seed 5 demo products + 7 months of sales data
- Each business sees only their own data

## API Routes
- `POST /api/register` - Register new business
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/user` - Get current user
- `GET /api/products` - List user's products
- `GET /api/recommendations` - List user's pricing recommendations
- `POST /api/recommendations/:id/apply` - Apply recommendation
- `GET /api/sales` - Get user's sales data
- `POST /api/pricing/run-model` - Run Gradient Boosting model

## Database Tables
- `users` - Business accounts (name, email, password, businessName)
- `products` - Product catalog per business (userId FK)
- `price_recommendations` - Gradient Boosting model outputs per business (userId FK)
- `sales_data` - Monthly sales metrics per business (userId FK)

## Key Features
- Multi-tenant: each business gets isolated data
- Gradient Boosting pricing engine with demand/inventory/competition analysis
- Business dashboard with revenue charts, inventory health, model recommendations
- All prices in Lesotho Maloti (M)
- Demo data automatically seeded on registration

Railway deployment instructions

This document describes a minimal set of steps to deploy LesonileStore to Railway (free tier) and a free Neon Postgres database.

Prerequisites
- GitHub repo connected (already pushed to https://github.com/monyatsi16/LesonlineStore.git)
- Railway account: https://railway.app
- Neon account (optional): https://neon.tech (or use Railway Postgres)

Steps
1. Create a Railway project
   - Sign in to Railway and create a new project.
   - Choose "Deploy from GitHub" and connect the repository `monyatsi16/LesonlineStore`.

2. Set up environment variables
   - In Railway, open the project settings → Variables.
   - Add these variables (example values):
     - `DATABASE_URL` = (copy connection string from Neon or Railway Postgres)
     - `NODE_ENV` = production
     - `PRICING_INTERVAL_MS` = 900000  # optional, 15 minutes in ms
     - `COMPETITOR_SCRAPING` = false
     - `PRICING_COOLDOWN_MINUTES` = 60
     - Email settings (if used): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` or `RESEND_API_KEY`

3. Configure the service
   - Railway will detect the project. Ensure the build command is `npm ci && npm run build` and the start command is `npm run start`.
   - Alternatively, Railway can use the included `Dockerfile`.

4. Database
   - Create a Neon or Railway Postgres database and copy the `DATABASE_URL` to Railway variables.
   - Run migrations (if needed) using your migration files in `migrations/`.
     - Example using `psql` or a Railway console: run SQL files in order or use a small script:

       psql "$DATABASE_URL" -f migrations/0000_pink_ghost_rider.sql

5. Deploy
   - Trigger a deploy from Railway (it will build and start the app).
   - Check logs; the server listens on the port Railway exposes. Ensure `server/index.ts` uses `process.env.PORT` or default 5000.

Safety notes for free hosting
- Disable heavy scraping or headless browsers: set `COMPETITOR_SCRAPING=false`.
- Start with `PRICING_INTERVAL_MS=900000` to avoid frequent scheduled jobs.

Optional: GitHub Actions to build
- A CI workflow has been added at `.github/workflows/ci.yml` to run type checks/build on push.

If you want, I can:
- Create a Railway project and connect it (you'll need to provide Railway API token or perform the OAuth steps),
- Or create a GitHub Actions workflow that deploys to Railway using a `RAILWAY_API_KEY` (you'll supply the secret).

Tell me which of those you prefer and I'll proceed.
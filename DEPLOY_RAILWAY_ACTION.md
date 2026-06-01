Deploy via GitHub Actions (Railway)

This repo includes a GitHub Actions workflow `.github/workflows/deploy_railway.yml` that will:
- Install dependencies and build the project
- Install the Railway CLI
- Login to Railway using `RAILWAY_API_KEY` secret
- Run `railway up --detach` to deploy/update the Railway project

What you must do:
1. Create an API key in Railway: https://railway.app -> Settings -> API Keys
2. In the GitHub repo settings (Secrets -> Actions), add `RAILWAY_API_KEY` with that value
3. Push to `main` to trigger the workflow

Alternative manual Railway deploy (no GitHub secret required):
1. Open Railway and create a new project.
2. Choose "Deploy from GitHub" and connect the repository `monyatsi16/LesonlineStore`.
3. Set the Railway environment variables:
   - `DATABASE_URL` = your Postgres connection string
   - `NODE_ENV` = `production`
   - `PRICING_INTERVAL_MS` = `900000`
   - `COMPETITOR_SCRAPING` = `false`
4. Save the project and start deploy from Railway.

Notes:
- The action requires the Railway API key with permissions to create/update projects. If you prefer to connect Railway via OAuth in the Railway console, you can skip adding the key and instead connect the repo manually in Railway.
- For a safe free-tier deployment, set these env vars in Railway:
  - `DATABASE_URL` (Neon or Railway Postgres)
  - `NODE_ENV=production`
  - `PRICING_INTERVAL_MS=900000`
  - `COMPETITOR_SCRAPING=false`

If you'd like, I can:
- Help generate the Railway API key and guide you through adding it to GitHub, or
- Connect Railway via OAuth (requires you to authorize in the Railway UI).

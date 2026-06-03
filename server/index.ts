import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { initPriceScheduler } from "./scheduler";
import { initializePricingModel } from "./training";
import { ensureLesOnlineBootstrap } from "./bootstrap";

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

// CORS
const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : ["*"];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && (corsOrigins.includes("*") || corsOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();
});

export function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString();
  console.log(`${time} [${source}] ${message}`);
}

(async () => {
  try {
    console.log("🚀 Starting server...");

    // IMPORTANT: START SERVER FIRST (Render requirement)
    const PORT = Number(process.env.PORT) || 10000;

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

    // Register routes (non-blocking)
    registerRoutes(httpServer, app)
      .then(() => console.log("✅ Routes registered"))
      .catch(err => console.error("❌ Routes error:", err));

    // Bootstrap (non-blocking)
    ensureLesOnlineBootstrap()
      .then(() => console.log("✅ Bootstrap complete"))
      .catch(err => console.error("❌ Bootstrap error:", err));

    // Static handling
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // Scheduler (safe background)
    const disableScheduler =
      process.env.DISABLE_SCHEDULER === "true";

    const disableModelTraining =
      process.env.DISABLE_MODEL_TRAINING === "true";

    if (!disableScheduler) {
      initPriceScheduler().catch(err =>
        console.error("Scheduler error:", err)
      );
    } else {
      console.log("⛔ Scheduler disabled");
    }

    if (!disableModelTraining) {
      initializePricingModel().catch(err =>
        console.error("Model error:", err)
      );
    } else {
      console.log("⛔ Model training disabled");
    }

  } catch (err) {
    console.error("💥 Fatal startup error:", err);
  }
})();
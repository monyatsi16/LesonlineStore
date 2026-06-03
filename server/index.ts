import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { exec } from "child_process";
import { initPriceScheduler } from "./scheduler";
import { initializePricingModel } from "./training";
import { ensureLesOnlineBootstrap } from "./bootstrap";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

function openBrowser(url: string) {
  const allowOpen = String(process.env.OPEN_BROWSER || "true").toLowerCase();
  if (allowOpen === "false") {
    return;
  }

  const command = process.platform === "win32"
    ? `start "" "${url}"`
    : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;

  exec(command, (error) => {
    if (error) {
      log(`Unable to open browser: ${error.message}`, "server");
    }
  });
}

function listenWithPortFallback(startPort: number, maxAttempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let currentPort = startPort;

    const tryListen = () => {
      const onError = (error: NodeJS.ErrnoException) => {
        httpServer.off("listening", onListening);

        if (error.code === "EADDRINUSE" && attempts < maxAttempts - 1) {
          attempts += 1;
          currentPort += 1;
          log(`Port in use, retrying on ${currentPort}`, "server");
          tryListen();
          return;
        }

        reject(error);
      };

      const onListening = () => {
        httpServer.off("error", onError);
        resolve(currentPort);
      };

      httpServer.once("error", onError);
      httpServer.once("listening", onListening);
      const host = process.env.HOST || "0.0.0.0";
      httpServer.listen({ port: currentPort, host });
    };

    tryListen();
  });
}

const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["*"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (corsOrigins.includes("*") || corsOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  await ensureLesOnlineBootstrap();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const initialPort = parseInt(process.env.PORT || "5000", 10);
  const activePort = await listenWithPortFallback(initialPort);
  const serverUrl = `http://localhost:${activePort}`;
  console.log(`\n  App is running at: ${serverUrl}\n`);
  openBrowser(serverUrl);

  // Start scheduler and model training depending on environment variables.
  // In constrained environments (free builders), set `DISABLE_SCHEDULER=true`
  // and/or `DISABLE_MODEL_TRAINING=true` to avoid heavy background work.
  const disableScheduler = String(process.env.DISABLE_SCHEDULER || "false").toLowerCase() === "true";
  const disableModelTraining = String(process.env.DISABLE_MODEL_TRAINING || "false").toLowerCase() === "true";

  if (!disableScheduler) {
    void (async () => {
      try {
        // Start scheduler first so the interval timer is registered immediately
        await initPriceScheduler();
      } catch (error) {
        console.error("Scheduler init failed:", error);
      }
    })();
  } else {
    console.log("Scheduler disabled by DISABLE_SCHEDULER=true");
  }

  if (!disableModelTraining) {
    void (async () => {
      try {
        await initializePricingModel();
        console.log("\u{1F4B0} Pricing model ready");
      } catch (error) {
        console.error("Pricing model init failed:", error);
      }
    })();
  } else {
    console.log("Model training disabled by DISABLE_MODEL_TRAINING=true");
  }
})();
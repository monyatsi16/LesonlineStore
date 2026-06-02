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
      const host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
      httpServer.listen({ port: currentPort, host });
    };

    tryListen();
  });
}

app.use((req, res, next) => {
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
  console.log(`\n  App is running at: http://localhost:${activePort}\n`);

  // Start scheduler immediately. It will skip cycles while the model is still training
  // and fire as soon as training completes. Model training runs in parallel.
  void (async () => {
    try {
      // Start scheduler first so the interval timer is registered immediately
      await initPriceScheduler();
    } catch (error) {
      console.error("Scheduler init failed:", error);
    }
  })();

  void (async () => {
    try {
      await initializePricingModel();
      console.log("\u{1F4B0} Pricing model ready");
    } catch (error) {
      console.error("Pricing model init failed:", error);
    }
  })();
})();
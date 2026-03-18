import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripe/webhook";
import { dailyScrape, weeklyCurate, monthlyVenues } from "../athens-scraper";

function scheduleCron(name: string, hour: number, dayOfMonth: number | null, dayOfWeek: number | null, fn: () => Promise<void>) {
  setInterval(async () => {
    const now = new Date();
    const matchHour = now.getHours() === hour && now.getMinutes() === 0;
    const matchDay = dayOfMonth === null || now.getDate() === dayOfMonth;
    const matchDow = dayOfWeek === null || now.getDay() === dayOfWeek;
    if (matchHour && matchDay && matchDow) {
      console.log(`[Cron] Running: ${name}`);
      try { await fn(); } catch (e) { console.error(`[Cron] ${name} failed:`, e); }
    }
  }, 60_000);
}

function startCronJobs() {
  scheduleCron("Athens daily scrape",   6, null, null, dailyScrape);
  scheduleCron("Athens weekly curate",  8, null, 1,    weeklyCurate);
  scheduleCron("Athens monthly venues", 9, 1,    null, monthlyVenues);
  console.log("[Cron] Scheduled: daily scrape (6am) · weekly curate (Mon 8am) · monthly venues (1st 9am)");
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Stripe webhook needs raw body — must be registered BEFORE express.json()
  app.post("/webhook/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startCronJobs();
  });
}

startServer().catch(console.error);

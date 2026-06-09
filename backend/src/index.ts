import { loadRepoEnv } from "./lib/load-repo-env.js";

loadRepoEnv();

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { rateLimit } from "./middleware/rate-limit.js";
import agentRoute from "./routes/agent.js";
import whatsappRoute from "./routes/whatsapp.js";
import userRoute from "./routes/user.js";
import realtimeRoute from "./routes/realtime.js";
import publicTasksRoute from "./routes/public-tasks.js";
import healthRoute from "./routes/health.js";
import authRoute from "./routes/auth.js";
import { env } from "./lib/env.js";
import { startJobQueue, stopJobQueue } from "./lib/job-queue.js";

const app = new Hono();

const isProduction = process.env.NODE_ENV === "production";
const allowedProductionOrigins = new Set(env.allowedProductionOrigins);
const productionDomain = "senqo.app";

function isAllowedProductionHostname(hostname: string): boolean {
  return hostname === productionDomain || hostname.endsWith(`.${productionDomain}`) || allowedProductionOrigins.has(hostname);
}

function isAllowedCorsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    if (!isProduction) {
      return url.hostname === "localhost";
    }

    return url.protocol === "https:" && isAllowedProductionHostname(url.hostname);
  } catch {
    return false;
  }
}

app.use(
  "*",
  cors({
    origin: (origin) => (isAllowedCorsOrigin(origin) ? origin : null),
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Api-Token",
      "X-Api-Key",
      "X-Workspace-Id",
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  }),
);

app.use("*", logger());

app.use(
  "*",
  secureHeaders({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: "same-origin",
    crossOriginOpenerPolicy: "same-origin",
    originAgentCluster: true,
    referrerPolicy: "strict-origin-when-cross-origin",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    xXssProtection: "0",
  }),
);

/** Internal WhatsApp service webhook — can burst after reconnect catch-up. */
function isWhatsappEventsWebhook(c: { req: { path: string } }): boolean {
  return c.req.path === "/api/whatsapp/events";
}

app.use(
  "*",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    skip: isWhatsappEventsWebhook,
  }),
);

app.post("*", async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    return c.json({ error: "payload_too_large" }, 413);
  }
  await next();
});

app.route("/api/agent", agentRoute);
app.route("/api/whatsapp", whatsappRoute);
app.route("/api/user", userRoute);
app.route("/api/realtime", realtimeRoute);
app.route("/api/tasks", publicTasksRoute);
app.route("/api/health", healthRoute);
app.route("/api/auth", authRoute);

app.onError((err, c) => {
  console.error("[GlobalError]", err);
  const isDev = process.env.NODE_ENV === "development";
  return c.json(
    {
      error: isDev ? err.message : "Internal server error",
      ...(isDev && { stack: err.stack }),
    },
    500,
  );
});

const port = Number(process.env.PORT ?? "3001");

async function main(): Promise<void> {
  await startJobQueue();

  serve({ fetch: app.fetch, hostname: "0.0.0.0", port }, (info) => {
    console.log(`[Server] Running on http://localhost:${info.port}`);
  });
}

function shutdown(): void {
  void stopJobQueue().finally(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

void main().catch((error) => {
  console.error("[Server] Failed to start:", error);
  process.exit(1);
});

export default app;

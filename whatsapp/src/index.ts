import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./env.js";
import { logger } from "./logger.js";
import {
  get,
  getOrCreate,
  removeSession,
  reviveSessions,
  startConnectionKeeper,
  startSession,
  stopAll,
} from "./session-manager.js";

const app = new Hono();

// ── Auth: every route except /health requires the shared service key. ─────────
app.use("*", async (c, next) => {
  if (c.req.path === "/health") return next();
  const key = c.req.header("x-api-key");
  if (!key || key !== env.serviceApiKey) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
});

app.get("/health", (c) => c.json({ ok: true }));

// ── Session lifecycle ─────────────────────────────────────────────────────────

app.post("/sessions/:id/start", async (c) => {
  const id = c.req.param("id");
  const session = await startSession(id);
  return c.json({ ok: true, state: session.getStatus().status });
});

app.get("/sessions/:id/qr", async (c) => {
  const id = c.req.param("id");
  let session = get(id);
  if (!session) {
    session = await startSession(id);
  }
  const { status } = session.getStatus();
  if (status === "authorized") {
    return c.json({ type: "alreadyLogged", message: "Already connected" });
  }
  const qr = session.getQr();
  if (qr) return c.json({ type: "qrCode", message: qr });
  return c.json({ type: "error", message: "QR not available" });
});

app.get("/sessions/:id/state", (c) => {
  const id = c.req.param("id");
  const session = get(id);
  if (!session) return c.json({ status: "not_authorized" });
  const { status, phone } = session.getStatus();
  return c.json({ status, phone });
});

app.post("/sessions/:id/restart", async (c) => {
  const id = c.req.param("id");
  await getOrCreate(id).restart();
  return c.json({ ok: true });
});

app.post("/sessions/:id/logout", async (c) => {
  const id = c.req.param("id");
  const session = get(id);
  if (session) await session.logout();
  return c.json({ ok: true });
});

app.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  await removeSession(id);
  return c.json({ ok: true });
});

// ── Messaging ───────────────────────────────────────────────────────────────

app.post("/sessions/:id/send-text", async (c) => {
  const id = c.req.param("id");
  const session = get(id);
  if (!session) return c.json({ error: "session not found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { chatId?: string; text?: string };
  if (!body.chatId || typeof body.text !== "string") {
    return c.json({ error: "chatId and text are required" }, 400);
  }
  try {
    const messageId = await session.sendText(body.chatId, body.text);
    return c.json({ messageId });
  } catch (error) {
    logger.error({ id, error: String(error) }, "send-text failed");
    return c.json({ error: String(error) }, 502);
  }
});

app.post("/sessions/:id/send-media", async (c) => {
  const id = c.req.param("id");
  const session = get(id);
  if (!session) return c.json({ error: "session not found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    chatId?: string;
    fileName?: string;
    mimeType?: string;
    dataBase64?: string;
    caption?: string;
  };
  if (!body.chatId || !body.dataBase64) {
    return c.json({ error: "chatId and dataBase64 are required" }, 400);
  }
  try {
    const messageId = await session.sendMedia({
      chatId: body.chatId,
      fileName: body.fileName ?? "file",
      mimeType: body.mimeType ?? "application/octet-stream",
      data: Buffer.from(body.dataBase64, "base64"),
      caption: body.caption,
    });
    return c.json({ messageId });
  } catch (error) {
    logger.error({ id, error: String(error) }, "send-media failed");
    return c.json({ error: String(error) }, 502);
  }
});

app.post("/sessions/:id/presence", async (c) => {
  const id = c.req.param("id");
  const session = get(id);
  if (!session) return c.json({ error: "session not found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    chatId?: string;
    presence?: "composing" | "recording";
  };
  if (!body.chatId) return c.json({ error: "chatId is required" }, 400);
  try {
    await session.sendPresence(body.chatId, body.presence === "recording" ? "recording" : "composing");
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ ok: false, error: String(error) });
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  serve({ fetch: app.fetch, port: env.port }, (info) => {
    logger.info({ port: info.port, logFile: env.logFile }, "whatsapp service listening");
  });
  await reviveSessions();
  startConnectionKeeper();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    logger.info({ sig }, "shutting down");
    stopAll();
    process.exit(0);
  });
}

void main();

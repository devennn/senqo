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
import type { SessionButton, SessionButtonType } from "./baileys-session.js";

const BUTTON_TYPES: readonly SessionButtonType[] = [
  "quick_reply",
  "cta_url",
  "cta_call",
  "cta_copy",
];

type ButtonsPayload = {
  chatId?: unknown;
  text?: unknown;
  footer?: unknown;
  buttons?: unknown;
};

function validateButtonsPayload(
  body: ButtonsPayload,
): { ok: true; chatId: string; text: string; buttons: SessionButton[] } | { ok: false; message: string } {
  if (typeof body.chatId !== "string" || body.chatId.trim().length === 0) {
    return { ok: false, message: "chatId is required" };
  }
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return { ok: false, message: "text is required" };
  }
  if (!Array.isArray(body.buttons) || body.buttons.length < 1 || body.buttons.length > 3) {
    return { ok: false, message: "1 to 3 buttons are required" };
  }

  const buttons: SessionButton[] = [];
  for (const raw of body.buttons) {
    const item = raw as { type?: unknown; label?: unknown; value?: unknown };
    if (
      typeof item?.type !== "string" ||
      typeof item?.label !== "string" ||
      typeof item?.value !== "string"
    ) {
      return { ok: false, message: "each button needs type, label and value" };
    }
    if (!(BUTTON_TYPES as readonly string[]).includes(item.type)) {
      return { ok: false, message: `unsupported button type: ${item.type}` };
    }
    const label = item.label.trim();
    const value = item.value.trim();
    if (label.length === 0 || value.length === 0) {
      return { ok: false, message: "each button needs a label and a value" };
    }
    if (item.type === "cta_url" && !/^https?:\/\//i.test(value)) {
      return { ok: false, message: "cta_url buttons need an http(s) link" };
    }
    buttons.push({ type: item.type as SessionButtonType, label, value });
  }

  return { ok: true, chatId: body.chatId.trim(), text: body.text.trim(), buttons };
}

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
  if (!session) return c.json({ status: "not_authorized", socketOpen: false });
  const { status, phone, socketOpen } = session.getStatus();
  return c.json({ status, phone, socketOpen });
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

app.post("/sessions/:id/send-buttons", async (c) => {
  const id = c.req.param("id");
  const session = get(id);
  if (!session) return c.json({ error: "session not found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as ButtonsPayload;
  const validation = validateButtonsPayload(body);
  if (!validation.ok) return c.json({ error: validation.message }, 400);
  try {
    const footer =
      typeof body.footer === "string" && body.footer.trim().length > 0
        ? body.footer.trim()
        : undefined;
    const messageId = await session.sendButtons({
      chatId: validation.chatId,
      text: validation.text,
      ...(footer ? { footer } : {}),
      buttons: validation.buttons,
    });
    return c.json({ messageId });
  } catch (error) {
    logger.error({ id, error: String(error) }, "send-buttons failed");
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

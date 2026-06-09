import { env } from "../lib/env.js";

/**
 * Client for the first-party Baileys WhatsApp service (`whatsapp/`).
 *
 * This replaces the former Evolution API client. The exported function names and
 * signatures are kept identical so the rest of the backend (routes, conversation
 * send paths, agent tools, scheduled tasks) is unchanged — only the transport
 * underneath swapped from Evolution's REST to our own service.
 *
 * A "connection id" (the `whatsapp_connections.id` UUID) is the session id on the
 * service. Inbound events are pushed by the service to `/api/whatsapp/events` in
 * the canonical `WhatsappBackendEvent` shape, so there is no inbound code here.
 */

const scope = "WhatsappClient";

const BASE = env.whatsappServiceUrl.replace(/\/$/, "");
const API_KEY = env.whatsappServiceApiKey;

async function svcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const method = init?.method ?? "GET";
  console.log(`[${scope}] Request`, { method, url });
  const response = await fetch(url, {
    ...init,
    headers: { "x-api-key": API_KEY, ...(init?.headers ?? {}) },
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`WhatsApp service request failed (${response.status}): ${bodyText}`);
  }
  if (!bodyText) return {} as T;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return {} as T;
  }
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isBenignSessionError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("(400)") ||
    msg.includes("(404)") ||
    msg.includes("not found") ||
    msg.includes("not connected")
  );
}

// ── QR ─────────────────────────────────────────────────────────────────────

export type QrResponse =
  | { type: "qrCode"; message: string }
  | { type: "alreadyLogged"; message: string }
  | { type: "error"; message: string };

export async function getQrCode(connectionId: string): Promise<QrResponse> {
  try {
    return await svcFetch<QrResponse>(`/sessions/${encodeURIComponent(connectionId)}/qr`);
  } catch (error) {
    console.warn(`[${scope}/getQrCode] ${String(error)}`);
    return { type: "error", message: "QR not available" };
  }
}

export async function getConnectionStatus(
  connectionId: string,
): Promise<{ status: string; phone?: string }> {
  try {
    return await svcFetch<{ status: string; phone?: string }>(
      `/sessions/${encodeURIComponent(connectionId)}/state`,
    );
  } catch {
    return { status: "not_authorized" };
  }
}

// ── Connection lifecycle ─────────────────────────────────────────────────────

export async function startConnection(
  connectionId: string,
): Promise<{ ok: boolean; state: string }> {
  const res = await svcFetch<{ ok: boolean; state: string }>(
    `/sessions/${encodeURIComponent(connectionId)}/start`,
    jsonInit("POST", {}),
  );
  return { ok: res.ok ?? true, state: res.state ?? "connecting" };
}

export async function restartConnection(connectionId: string): Promise<void> {
  try {
    await svcFetch(`/sessions/${encodeURIComponent(connectionId)}/restart`, jsonInit("POST", {}));
  } catch (error) {
    if (!isBenignSessionError(error)) console.warn(`[${scope}/restartConnection] ${String(error)}`);
  }
}

export async function logoutConnection(connectionId: string): Promise<void> {
  try {
    await svcFetch(`/sessions/${encodeURIComponent(connectionId)}/logout`, jsonInit("POST", {}));
  } catch (error) {
    if (!isBenignSessionError(error)) console.warn(`[${scope}/logoutConnection] ${String(error)}`);
  }
}

export async function destroyConnection(connectionId: string): Promise<void> {
  try {
    await svcFetch(`/sessions/${encodeURIComponent(connectionId)}`, { method: "DELETE" });
  } catch (error) {
    if (!isBenignSessionError(error)) console.warn(`[${scope}/destroyConnection] ${String(error)}`);
  }
}

/** Stop/clean up a session we no longer have a DB row for (orphan cleanup). */
export async function stopConnection(connectionId: string): Promise<void> {
  try {
    await svcFetch(`/sessions/${encodeURIComponent(connectionId)}`, { method: "DELETE" });
  } catch (error) {
    if (!isBenignSessionError(error)) console.warn(`[${scope}/stopConnection] ${String(error)}`);
  }
}

// ── Sending ──────────────────────────────────────────────────────────────────

export async function sendTextMessageCompat(
  connectionId: string,
  payload: { chatId: string; text: string; quotedMessageId?: string },
): Promise<{ messageId: string }> {
  const res = await svcFetch<{ messageId: string }>(
    `/sessions/${encodeURIComponent(connectionId)}/send-text`,
    jsonInit("POST", { chatId: payload.chatId, text: payload.text }),
  );
  return { messageId: res.messageId ?? "" };
}

export async function uploadAndSendMedia(
  connectionId: string,
  args: { chatId: string; fileName: string; mimeType: string; data: ArrayBuffer; caption?: string },
): Promise<{ messageId: string }> {
  const dataBase64 = Buffer.from(args.data).toString("base64");
  const res = await svcFetch<{ messageId: string }>(
    `/sessions/${encodeURIComponent(connectionId)}/send-media`,
    jsonInit("POST", {
      chatId: args.chatId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      dataBase64,
      caption: args.caption,
    }),
  );
  return { messageId: res.messageId ?? "" };
}

export async function sendMediaByUrl(
  connectionId: string,
  payload: { chatId: string; url: string; fileName: string; caption?: string; mimeType?: string },
): Promise<{ messageId: string }> {
  const download = await fetch(payload.url);
  if (!download.ok) throw new Error(`Failed to download media from URL: ${payload.url}`);
  const data = await download.arrayBuffer();
  const mimeType =
    payload.mimeType ?? download.headers.get("content-type") ?? "application/octet-stream";
  return uploadAndSendMedia(connectionId, {
    chatId: payload.chatId,
    fileName: payload.fileName,
    mimeType,
    data,
    caption: payload.caption,
  });
}

export async function sendTyping(
  connectionId: string,
  payload: { chatId: string; durationMs?: number; typingType?: "recording" },
): Promise<void> {
  try {
    await svcFetch(`/sessions/${encodeURIComponent(connectionId)}/presence`, jsonInit("POST", {
      chatId: payload.chatId,
      presence: payload.typingType === "recording" ? "recording" : "composing",
    }));
  } catch (error) {
    console.warn(`[${scope}/sendTyping] ${String(error)}`);
  }
}

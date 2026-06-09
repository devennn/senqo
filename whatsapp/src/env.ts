import path from "node:path";

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value.trim();
}

/**
 * Configuration for the Baileys WhatsApp service.
 *
 * - `serviceApiKey` guards the inbound REST API (backend sends it as `x-api-key`).
 * - `backendWebhookUrl` + `webhookToken` are how this service pushes canonical
 *   `WhatsappBackendEvent`s back to the backend (`?token=` matches the backend's
 *   `WHATSAPP_WEBHOOK_AUTHORIZATION`).
 */
export const env = {
  port: Number(optional("PORT", "8080")),
  /** Shared secret the backend must present on every REST call (`x-api-key`). */
  serviceApiKey: required("WHATSAPP_SERVICE_API_KEY"),
  /** Backend endpoint that ingests canonical events. */
  backendWebhookUrl: optional(
    "BACKEND_WEBHOOK_URL",
    "http://backend:3001/api/whatsapp/events",
  ),
  /** Shared secret appended as `?token=` on webhook delivery. */
  webhookToken: required("WHATSAPP_WEBHOOK_AUTHORIZATION"),
  /** Directory holding per-connection multi-file auth state (Docker volume). */
  sessionsDir: path.resolve(optional("SESSIONS_DIR", "/app/sessions")),
  logLevel: optional("LOG_LEVEL", "info"),
  /** Append-only service log (JSON lines); bind-mount `./whatsapp/logs` in Compose. */
  logFile: path.resolve(optional("LOG_FILE", "/app/logs/whatsapp.log")),
  /** Pretty-print logs in development. */
  isDev: optional("NODE_ENV", "production") !== "production",
  /** Hard cap on inbound media we will base64-inline into a webhook (bytes). */
  maxInlineMediaBytes: Number(optional("MAX_INLINE_MEDIA_BYTES", String(64 * 1024 * 1024))),
} as const;

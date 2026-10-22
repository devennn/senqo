import { parseModelProvider } from "./model-provider.js";
import { loadModelEnv } from "./model-env.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

/** 32-byte hex key check — any other form would silently weaken AES-256-GCM (S-07). */
function requireHexKey(name: string): string {
  const value = requireEnv(name);
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(
      `${name} must be 64 hexadecimal characters (32 bytes) — generate one with \`openssl rand -hex 32\`.`,
    );
  }
  return value;
}

const modelEnv = loadModelEnv(
  parseModelProvider(requireEnv("MODEL_PROVIDER")),
);

export type { ModelProvider } from "./model-provider.js";

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3001",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  ...modelEnv,
  /** Quiet period before running the agent on batched WhatsApp inbound (1–60s). */
  inboundAiDebounceSeconds: clampInt(
    process.env.INBOUND_AI_DEBOUNCE_SECONDS,
    7,
    1,
    60,
  ),
  smtpHost: requireEnv("SMTP_HOST"),
  smtpPort: requireEnv("SMTP_PORT"),
  smtpUser: requireEnv("SMTP_USER"),
  smtpPass: requireEnv("SMTP_PASS"),
  smtpFromEmail: requireEnv("SMTP_FROM_EMAIL"),
  whatsappWebhookAuthorization: requireEnv("WHATSAPP_WEBHOOK_AUTHORIZATION"),
  /** Extra production CORS origins beyond `senqo.app` and its subdomains (comma-separated hostnames, e.g. preview deploys). */
  allowedProductionOrigins: (process.env.ALLOWED_PRODUCTION_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** Baileys WhatsApp service base URL (internal Docker network). */
  whatsappServiceUrl:
    process.env.WHATSAPP_SERVICE_URL ?? "http://whatsapp:8080",
  /** Shared secret presented to the WhatsApp service as the `x-api-key` header. */
  whatsappServiceApiKey: process.env.WHATSAPP_SERVICE_API_KEY ?? "",
  /** Days to keep webhook payload dumps; `0` keeps them forever (S-09 retention). */
  whatsappPayloadDumpRetentionDays: clampInt(
    process.env.WHATSAPP_PAYLOAD_DUMP_RETENTION_DAYS,
    30,
    0,
    3650,
  ),
  apiKeyPepper: requireEnv("API_KEY_PEPPER"),
  /** AES-256-GCM key for workspace secrets (32-byte hex from openssl rand -hex 32). */
  workspaceSecretsKey: requireHexKey("WORKSPACE_SECRETS_KEY"),
  bootstrapAdminEmail:
    process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? "",
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "",
  bootstrapWorkspaceName:
    process.env.BOOTSTRAP_WORKSPACE_NAME?.trim() || "Default Workspace",
  initialAllowPublicRegistration:
    process.env.ALLOW_PUBLIC_REGISTRATION !== "false",
  /** Optional breached-password screening at registration (opt-in: PASSWORD_BREACH_CHECK=on). */
  passwordBreachCheck: process.env.PASSWORD_BREACH_CHECK === "on",
  /** Optional override for eval Spec agent; falls back to chat LLM. */
  evalSpecModel: process.env.EVAL_SPEC_MODEL?.trim() || "",
  /** Optional override for eval Judge agent; falls back to chat LLM. */
  evalJudgeModel: process.env.EVAL_JUDGE_MODEL?.trim() || "",
  /** Composio API key for Connect Apps (Google Drive). Empty disables connect/execute. */
  composioApiKey: process.env.COMPOSIO_API_KEY?.trim() || "",
};

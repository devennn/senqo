import type { Context, Next } from "hono";

const CANONICAL_PRODUCTION_API_HOST = "api.senqo.app";

function normalizeHost(host: string): string {
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

function resolveRequestHost(c: Context): string {
  const forwardedHost = c.req.header("x-forwarded-host")?.trim();
  if (forwardedHost) {
    return normalizeHost(forwardedHost.split(",")[0]?.trim() ?? "");
  }
  const hostHeader = c.req.header("host")?.trim();
  if (hostHeader) {
    return normalizeHost(hostHeader.split(":")[0]?.trim() ?? "");
  }
  return "";
}

function getProductionAllowedHosts(): Set<string> {
  const hosts = new Set<string>([normalizeHost(CANONICAL_PRODUCTION_API_HOST)]);
  const raw = process.env.PUBLIC_API_ALLOWED_HOSTS?.trim();
  if (!raw) {
    return hosts;
  }
  for (const part of raw.split(",")) {
    const h = normalizeHost(part);
    if (h) {
      hosts.add(h);
    }
  }
  return hosts;
}

export async function apiHostGuardMiddleware(
  c: Context,
  next: Next,
): Promise<Response | void> {
  if (process.env.NODE_ENV !== "production") {
    await next();
    return;
  }
  const host = resolveRequestHost(c);
  if (!getProductionAllowedHosts().has(host)) {
    return c.json({ ok: false, error: "forbidden_host" }, 403);
  }
  await next();
}

import type { Context, Next } from "hono";
import {
  normalizePublicApiHostname,
  resolvePublicApiAllowedHosts,
} from "../lib/public-api-host.js";

function resolveRequestHost(c: Context): string {
  const forwardedHost = c.req.header("x-forwarded-host")?.trim();
  if (forwardedHost) {
    return normalizePublicApiHostname(forwardedHost.split(",")[0]?.trim() ?? "");
  }
  const hostHeader = c.req.header("host")?.trim();
  if (hostHeader) {
    return normalizePublicApiHostname(hostHeader);
  }
  return "";
}

function getProductionAllowedHosts(): Set<string> {
  return new Set(
    resolvePublicApiAllowedHosts(process.env.API_URL, process.env.FRONTEND_URL),
  );
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

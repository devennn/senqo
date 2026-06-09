import type { Context, Next } from "hono";
import { verifyApiKey } from "../repositories/api-keys.js";

export type ApiKeyAuthVariables = {
  workspaceId: string;
};

function getApiKeyFromHeaders(c: Context): string {
  const headerToken = c.req.header("x-api-key")?.trim();
  if (headerToken) {
    return headerToken;
  }
  const bearerToken = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearerToken?.trim() ?? "";
}

export async function apiKeyAuthMiddleware(
  c: Context<{ Variables: ApiKeyAuthVariables }>,
  next: Next,
): Promise<Response | void> {
  const apiKey = getApiKeyFromHeaders(c);
  if (!apiKey) {
    return c.json({ ok: false, error: "invalid_api_key" }, 401);
  }
  const result = await verifyApiKey(apiKey);
  if (!result.ok) {
    return c.json({ ok: false, error: result.reason }, 401);
  }
  c.set("workspaceId", result.workspaceId);
  await next();
}

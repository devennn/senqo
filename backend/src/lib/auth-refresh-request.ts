import type { Context } from "hono";
import { REFRESH_COOKIE } from "./auth-cookie.js";

/** Refresh token from httpOnly cookie or JSON body (SPA fallback when cookies are unavailable). */
export async function readRefreshTokenFromRequest(c: Context): Promise<string | null> {
  const cookieHeader = c.req.header("cookie") ?? "";
  const cookieMatch = cookieHeader.match(new RegExp(`${REFRESH_COOKIE}=([^;]+)`));
  const fromCookie = cookieMatch?.[1]?.trim();
  if (fromCookie) return fromCookie;

  try {
    const json = (await c.req.json().catch(() => null)) as { refreshToken?: string } | null;
    const fromBody = json?.refreshToken?.trim();
    return fromBody || null;
  } catch {
    return null;
  }
}

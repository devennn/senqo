/** Whether refresh-token cookies require HTTPS (off for local http:// Compose). */
export function isAuthCookieSecure(): boolean {
  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  const appUrl = process.env.APP_URL ?? "";
  return appUrl.startsWith("https://");
}

export const REFRESH_COOKIE = "senqo_refresh";

export function refreshCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: isAuthCookieSecure(),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 60 * 60 * 24 * 7,
  };
}

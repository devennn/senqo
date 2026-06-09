import { Hono } from "hono";
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import { createUser, findUserByEmail, findUserById } from "../repositories/auth-users.js";
import { hashPassword, verifyPassword } from "../lib/auth-users.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyToken } from "../lib/auth-jwt.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "../lib/auth-cookie.js";
import { readRefreshTokenFromRequest } from "../lib/auth-refresh-request.js";
import { ensureProfile } from "../repositories/profiles.js";

function authTokensResponse(
  user: { id: string; email: string },
  accessToken: string,
  refreshToken: string,
) {
  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoute = new Hono()
  .post("/register", async (c) => {
    const parsed = registerSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

    const { email, password, fullName } = parsed.data;

    const existing = await findUserByEmail(email);
    if (existing) return c.json({ error: "email_already_exists" }, 409);

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const user = await createUser(email, passwordHash, userId);

    await ensureProfile(user.id, user.email, fullName ?? "");

    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    setCookie(c, REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return c.json(authTokensResponse(user, accessToken, refreshToken));
  })
  .post("/login", async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if (!user || !user.passwordHash) return c.json({ error: "invalid_credentials" }, 401);

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) return c.json({ error: "invalid_credentials" }, 401);

    await ensureProfile(user.id, user.email, "");

    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    setCookie(c, REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return c.json(authTokensResponse(user, accessToken, refreshToken));
  })
  .post("/refresh", async (c) => {
    const token = await readRefreshTokenFromRequest(c);

    if (!token) return c.json({ error: "no_refresh_token" }, 401);

    const result = await verifyRefreshToken(token);
    if (!result) return c.json({ error: "invalid_refresh_token" }, 401);

    const user = await findUserById(result.userId);
    if (!user) return c.json({ error: "user_not_found" }, 401);

    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    setCookie(c, REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return c.json(authTokensResponse(user, accessToken, refreshToken));
  })
  .post("/logout", async (c) => {
    deleteCookie(c, REFRESH_COOKIE, {
      path: "/api/auth",
      secure: refreshCookieOptions().secure,
    });
    return c.json({ ok: true });
  })
  .get("/session", async (c) => {
    const auth = c.req.header("Authorization") ?? "";
    const token = auth.replace("Bearer ", "").trim();

    if (!token) return c.json({ error: "unauthorized" }, 401);

    const result = await verifyToken(token);
    if (!result) return c.json({ error: "unauthorized" }, 401);

    const user = await findUserById(result.userId);
    if (!user) return c.json({ error: "user_not_found" }, 404);

    return c.json({ user: { id: user.id, email: user.email } });
  });

export default authRoute;
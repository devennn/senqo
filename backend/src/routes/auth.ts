import { Hono } from "hono";
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import {
  createUser,
  findUserByEmail,
  findUserById,
  isUserDisabled,
} from "../repositories/auth-users.js";
import { hashPassword, verifyPassword } from "../lib/auth-users.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyToken } from "../lib/auth-jwt.js";
import { REFRESH_COOKIE, refreshCookieOptions } from "../lib/auth-cookie.js";
import { readRefreshTokenFromRequest } from "../lib/auth-refresh-request.js";
import {
  provisionOwnerWorkspace,
  provisionPlatformUser,
} from "../repositories/profiles.js";
import { getAllowPublicRegistration } from "../repositories/instance-settings.js";
import {
  acceptRegistrationInvite,
  getRegistrationInviteByToken,
} from "../repositories/registration-invites.js";

function authTokensResponse(
  user: { id: string; email: string; isInstanceAdmin?: boolean },
  accessToken: string,
  refreshToken: string,
) {
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      isInstanceAdmin: user.isInstanceAdmin ?? false,
    },
  };
}

async function rejectIfDisabled(user: Awaited<ReturnType<typeof findUserById>>) {
  if (!user) return null;
  if (await isUserDisabled(user)) return "account_disabled" as const;
  return null;
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().trim().optional(),
  inviteToken: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoute = new Hono()
  .get("/config", async (c) => {
    const allowPublicRegistration = await getAllowPublicRegistration();
    return c.json({ allowPublicRegistration });
  })
  .get("/invite", async (c) => {
    const token = c.req.query("token")?.trim() ?? "";
    if (!token) return c.json({ error: "invalid_invite" }, 404);

    const invite = await getRegistrationInviteByToken(token);
    if (!invite || !invite.valid) return c.json({ error: "invalid_invite" }, 404);

    return c.json({ email: invite.email });
  })
  .post("/register", async (c) => {
    const parsed = registerSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

    const { email, password, fullName, inviteToken } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const allowPublicRegistration = await getAllowPublicRegistration();

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
    if (await isUserDisabled(existing)) {
        return c.json({ error: "account_disabled" }, 403);
      }
      return c.json({ error: "email_already_exists" }, 409);
    }

    if (!allowPublicRegistration) {
      if (!inviteToken) {
        return c.json({ error: "registration_disabled" }, 403);
      }
      const preview = await getRegistrationInviteByToken(inviteToken);
      if (!preview || !preview.valid || preview.email !== normalizedEmail) {
        return c.json({ error: "invalid_invite" }, 403);
      }
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const user = await createUser(normalizedEmail, passwordHash, userId);

    if (!allowPublicRegistration && inviteToken) {
      const accepted = await acceptRegistrationInvite(inviteToken, user.id, normalizedEmail);
      if (!accepted.ok) {
        return c.json({ error: accepted.message }, 403);
      }
      await provisionPlatformUser(user.id, fullName ?? "");
    } else {
      await provisionOwnerWorkspace(user.id, user.email, fullName ?? "");
    }

    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    setCookie(c, REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return c.json(
      authTokensResponse(
        { id: user.id, email: user.email, isInstanceAdmin: user.isInstanceAdmin },
        accessToken,
        refreshToken,
      ),
    );
  })
  .post("/login", async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

    const { email, password } = parsed.data;

    const user = await findUserByEmail(email);
    if (!user || !user.passwordHash) return c.json({ error: "invalid_credentials" }, 401);

    const disabled = await rejectIfDisabled(user);
    if (disabled) return c.json({ error: disabled }, 403);

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) return c.json({ error: "invalid_credentials" }, 401);

    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    setCookie(c, REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return c.json(
      authTokensResponse(
        { id: user.id, email: user.email, isInstanceAdmin: user.isInstanceAdmin },
        accessToken,
        refreshToken,
      ),
    );
  })
  .post("/refresh", async (c) => {
    const token = await readRefreshTokenFromRequest(c);

    if (!token) return c.json({ error: "no_refresh_token" }, 401);

    const result = await verifyRefreshToken(token);
    if (!result) return c.json({ error: "invalid_refresh_token" }, 401);

    const user = await findUserById(result.userId);
    if (!user) return c.json({ error: "user_not_found" }, 401);

    const disabled = await rejectIfDisabled(user);
    if (disabled) return c.json({ error: disabled }, 403);

    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    setCookie(c, REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return c.json(
      authTokensResponse(
        { id: user.id, email: user.email, isInstanceAdmin: user.isInstanceAdmin },
        accessToken,
        refreshToken,
      ),
    );
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

    const disabled = await rejectIfDisabled(user);
    if (disabled) return c.json({ error: disabled }, 403);

    return c.json({
      user: { id: user.id, email: user.email },
      isInstanceAdmin: user.isInstanceAdmin,
    });
  });

export default authRoute;

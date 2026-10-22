import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  passwordHash: "hashed_password",
  isInstanceAdmin: false,
  disabledAt: null,
  createdAt: new Date(),
  emailVerifiedAt: null,
};

vi.mock("../lib/auth-users.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../repositories/auth-users.js", () => ({
  createUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com", isInstanceAdmin: false }),
  findUserByEmail: vi.fn().mockResolvedValue(null),
  findUserById: vi.fn().mockResolvedValue(null),
  updateUserPassword: vi.fn().mockResolvedValue(undefined),
  isUserDisabled: vi.fn().mockReturnValue(false),
}));

vi.mock("../lib/auth-jwt.js", () => ({
  signAccessToken: vi.fn().mockImplementation((userId: string) =>
    Promise.resolve(`access-token-${userId}`),
  ),
  signRefreshToken: vi.fn().mockImplementation((userId: string) =>
    Promise.resolve(`refresh-token-${userId}`),
  ),
  verifyToken: vi.fn().mockImplementation((token: string) => {
    const match = /^access-token-(.+)$/.exec(token);
    return match ? Promise.resolve({ userId: match[1] }) : Promise.resolve(null);
  }),
  verifyRefreshToken: vi.fn().mockImplementation((token: string) => {
    const match = /^refresh-token-(.+)$/.exec(token);
    return match ? Promise.resolve({ userId: match[1] }) : Promise.resolve(null);
  }),
}));

vi.mock("../repositories/instance-settings.js", () => ({
  getAllowPublicRegistration: vi.fn().mockResolvedValue(true),
}));

vi.mock("../repositories/profiles.js", () => ({
  provisionOwnerWorkspace: vi.fn().mockResolvedValue("ws-1"),
  provisionPlatformUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../repositories/registration-invites.js", () => ({
  getRegistrationInviteByToken: vi.fn().mockResolvedValue(null),
  acceptRegistrationInvite: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../lib/env.js", () => ({
  env: { passwordBreachCheck: false },
}));

import {
  hashPassword,
  verifyPassword,
} from "../lib/auth-users.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../repositories/auth-users.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/auth-jwt.js";
import { provisionOwnerWorkspace } from "../repositories/profiles.js";
import { getAllowPublicRegistration } from "../repositories/instance-settings.js";
import { LOGIN_MAX_FAILURES } from "../middleware/login-attempts.js";

const hashPasswordMock = vi.mocked(hashPassword);
const verifyPasswordMock = vi.mocked(verifyPassword);
const createUserMock = vi.mocked(createUser);
const findUserByEmailMock = vi.mocked(findUserByEmail);
const findUserByIdMock = vi.mocked(findUserById);
const signAccessTokenMock = vi.mocked(signAccessToken);
const signRefreshTokenMock = vi.mocked(signRefreshToken);
const verifyRefreshTokenMock = vi.mocked(verifyRefreshToken);
const provisionOwnerWorkspaceMock = vi.mocked(provisionOwnerWorkspace);
const getAllowPublicRegistrationMock = vi.mocked(getAllowPublicRegistration);

let app: Hono;

async function createApp() {
  const { authRoute } = await import("../routes/auth.js");
  app = new Hono().route("/", authRoute);
  return app;
}

beforeEach(async () => {
  findUserByEmailMock.mockReset();
  findUserByIdMock.mockReset();
  signAccessTokenMock.mockReset();
  signRefreshTokenMock.mockReset();
  verifyRefreshTokenMock.mockReset();
  provisionOwnerWorkspaceMock.mockReset();
  getAllowPublicRegistrationMock.mockReset();

  findUserByEmailMock.mockResolvedValue(null);
  findUserByIdMock.mockResolvedValue(null);
  signAccessTokenMock.mockImplementation((userId: string) =>
    Promise.resolve(`access-token-${userId}`),
  );
  signRefreshTokenMock.mockImplementation((userId: string) =>
    Promise.resolve(`refresh-token-${userId}`),
  );
  verifyRefreshTokenMock.mockImplementation((token: string) => {
    const match = /^refresh-token-(.+)$/.exec(token);
    return match ? Promise.resolve({ userId: match[1] }) : Promise.resolve(null);
  });
  provisionOwnerWorkspaceMock.mockResolvedValue("ws-1");
  getAllowPublicRegistrationMock.mockResolvedValue(true);

  await createApp();
});

describe("POST /register", () => {
  // Valid email + password with registration enabled → user created, tokens returned, owner workspace provisioned with 200, needed to verify successful registration flow.
  it("creates user, returns tokens with 200", async () => {
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "valid-test-passphrase",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBe("access-token-user-1");
    expect(body.refreshToken).toBe("refresh-token-user-1");
    expect(body.user).toEqual({ id: "user-1", email: "test@example.com", isInstanceAdmin: false });
    expect(provisionOwnerWorkspaceMock).toHaveBeenCalled();
  });

  // Public registration is off and no valid invite → 403 is returned with registration_disabled, needed to enforce the instance-wide registration gate.
  it("rejects registration when public registration is off and no invite", async () => {
    getAllowPublicRegistrationMock.mockResolvedValue(false);

    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "valid-test-passphrase",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("registration_disabled");
  });

  // Email already exists in the database → 409 is returned with email_already_exists, needed to prevent duplicate user registration.
  it("rejects duplicate email with 409", async () => {
    findUserByEmailMock.mockResolvedValue(mockUser);

    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "valid-test-passphrase",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("email_already_exists");
  });

  // Email format is invalid → 400 with invalid_payload, needed to validate input at the route boundary via Zod schema.
  it("rejects invalid email format with 400", async () => {
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "valid-test-passphrase",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_payload");
  });

  // Password is too short (<12 chars) → 400 with invalid_payload, needed to enforce the minimum password length policy via Zod schema.
  it("rejects short password with 400", async () => {
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "short",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_payload");
  });

  // Security regression (S-10): a long but widely-leaked password must be refused with a specific
  // error so users pick something an attacker cannot replay from breach corpora.
  it("rejects a common breached password with 400", async () => {
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "qwertyqwerty",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("password_too_common");
  });
});

describe("POST /login", () => {
  // Valid email + password → access token in body, refresh token in body and set-cookie, user object returned with 200, needed to verify successful login flow.
  it("returns access token and sets refresh cookie with 200", async () => {
    findUserByEmailMock.mockResolvedValue(mockUser);

    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "valid-test-passphrase",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBe("access-token-user-1");
    expect(body.refreshToken).toBe("refresh-token-user-1");
    expect(body.user).toEqual({ id: "user-1", email: "test@example.com", isInstanceAdmin: false });

    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("senqo_refresh");
  });

  // Correct email but wrong password → 401 with invalid_credentials, needed to reject wrong credentials without revealing which field was wrong.
  it("rejects wrong password with 401", async () => {
    findUserByEmailMock.mockResolvedValue(mockUser);
    verifyPasswordMock.mockResolvedValue(false);

    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "wrongpassword",
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });

  // Email does not exist in the database → 401 with invalid_credentials, needed to avoid leaking whether an account exists.
  it("rejects unknown email with 401", async () => {
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "unknown@example.com",
        password: "valid-test-passphrase",
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });
});

describe("POST /login — brute-force lockout", () => {
  // Security regression (S-03): repeated wrong passwords previously never throttled. After
  // LOGIN_MAX_FAILURES failures for the same account + IP the next attempt must be refused with
  // 429 too_many_attempts and a Retry-After header instead of hashing another guess.
  it("locks out after repeated wrong passwords → 429 with Retry-After", async () => {
    findUserByEmailMock.mockResolvedValue(mockUser);
    verifyPasswordMock.mockResolvedValue(false);
    const headers = { "Content-Type": "application/json", "x-real-ip": "203.0.113.90" };
    const body = JSON.stringify({ email: "lockout@example.com", password: "wrongpassword" });

    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      const res = await app.request("/login", { method: "POST", headers, body });
      expect(res.status).toBe(401);
    }

    const blocked = await app.request("/login", { method: "POST", headers, body });
    expect(blocked.status).toBe(429);
    const blockedBody = await blocked.json();
    expect(blockedBody.error).toBe("too_many_attempts");
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);

    // Even a correct password must be refused while the account + IP is locked out.
    verifyPasswordMock.mockResolvedValue(true);
    const blockedWithGoodPassword = await app.request("/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "lockout@example.com", password: "password123" }),
    });
    expect(blockedWithGoodPassword.status).toBe(429);
  });

  // A correct password below the threshold must still sign in, and success must clear the failure
  // counter so earlier typos cannot push the account over the limit later.
  it("signs in below the threshold and clears the failure counter on success", async () => {
    findUserByEmailMock.mockResolvedValue(mockUser);
    verifyPasswordMock.mockResolvedValue(false);
    const headers = { "Content-Type": "application/json", "x-real-ip": "203.0.113.91" };
    const wrongBody = JSON.stringify({ email: "clear@example.com", password: "wrongpassword" });
    const rightBody = JSON.stringify({ email: "clear@example.com", password: "password123" });

    const firstAttempt = await app.request("/login", { method: "POST", headers, body: wrongBody });
    expect(firstAttempt.status).toBe(401);

    verifyPasswordMock.mockResolvedValue(true);
    const ok = await app.request("/login", { method: "POST", headers, body: rightBody });
    expect(ok.status).toBe(200);

    // Counter was cleared: a fresh below-threshold run must not be blocked early.
    verifyPasswordMock.mockResolvedValue(false);
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) {
      const res = await app.request("/login", { method: "POST", headers, body: wrongBody });
      expect(res.status).toBe(401);
    }
  });

  // Unknown emails must count toward the lockout too — otherwise an attacker could probe for
  // accounts with unlimited guesses and only real accounts would be throttled.
  it("counts unknown-email failures toward the lockout", async () => {
    findUserByEmailMock.mockResolvedValue(null);
    const headers = { "Content-Type": "application/json", "x-real-ip": "203.0.113.92" };
    const body = JSON.stringify({ email: "ghost@example.com", password: "whatever" });

    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      const res = await app.request("/login", { method: "POST", headers, body });
      expect(res.status).toBe(401);
    }

    const blocked = await app.request("/login", { method: "POST", headers, body });
    expect(blocked.status).toBe(429);
  });
});

describe("POST /refresh", () => {
  // Valid refresh cookie present with non-disabled user → new access and refresh tokens returned with 200, needed to verify token rotation happy path.
  it("returns new access token from valid refresh cookie with 200", async () => {
    findUserByIdMock.mockResolvedValue(mockUser);

    const res = await app.request("/refresh", {
      method: "POST",
      headers: {
        Cookie: "senqo_refresh=refresh-token-user-1",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBe("access-token-user-1");
    expect(body.refreshToken).toBe("refresh-token-user-1");
  });

  // No refresh cookie in the request → 401 with no_refresh_token, needed to reject requests missing the required cookie.
  it("rejects expired or missing refresh token with 401", async () => {
    const res = await app.request("/refresh", {
      method: "POST",
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("no_refresh_token");
  });

  // Refresh cookie contains a token that fails JWT verification → 401 with invalid_refresh_token, needed to reject tampered or expired tokens.
  it("rejects invalid refresh token with 401", async () => {
    const res = await app.request("/refresh", {
      method: "POST",
      headers: {
        Cookie: "senqo_refresh=some-invalid-token",
      },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_refresh_token");
  });
});

describe("POST /logout", () => {
  // Request to logout → refresh cookie is cleared and 200 with ok:true, needed to verify the client can reliably end a session.
  it("clears refresh cookie and returns 200 with ok:true", async () => {
    const res = await app.request("/logout", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("senqo_refresh");
    expect(setCookieHeader!.toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/i);
  });
});

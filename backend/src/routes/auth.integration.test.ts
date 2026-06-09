import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  passwordHash: "hashed_password",
};

vi.mock("../lib/auth-users.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../repositories/auth-users.js", () => ({
  createUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@example.com" }),
  findUserByEmail: vi.fn().mockResolvedValue(null),
  findUserById: vi.fn().mockResolvedValue(null),
  updateUserPassword: vi.fn().mockResolvedValue(undefined),
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

vi.mock("../repositories/profiles.js", () => ({
  ensureProfile: vi.fn().mockResolvedValue(undefined),
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
import { ensureProfile } from "../repositories/profiles.js";

const hashPasswordMock = vi.mocked(hashPassword);
const verifyPasswordMock = vi.mocked(verifyPassword);
const createUserMock = vi.mocked(createUser);
const findUserByEmailMock = vi.mocked(findUserByEmail);
const findUserByIdMock = vi.mocked(findUserById);
const signAccessTokenMock = vi.mocked(signAccessToken);
const signRefreshTokenMock = vi.mocked(signRefreshToken);
const verifyRefreshTokenMock = vi.mocked(verifyRefreshToken);
const ensureProfileMock = vi.mocked(ensureProfile);

let app: Hono;

async function createApp() {
  const { authRoute } = await import("../routes/auth.js");
  app = new Hono().route("/", authRoute);
  return app;
}

beforeEach(async () => {
  // Reset all mocks
  findUserByEmailMock.mockReset();
  findUserByIdMock.mockReset();
  signAccessTokenMock.mockReset();
  signRefreshTokenMock.mockReset();
  verifyRefreshTokenMock.mockReset();
  ensureProfileMock.mockReset();

  // Re-apply default implementations
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
  ensureProfileMock.mockResolvedValue(undefined);

  // Re-create app for isolation
  await createApp();
});

describe("POST /register", () => {
  it("creates user, returns tokens with 200", async () => {
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBe("access-token-user-1");
    expect(body.refreshToken).toBe("refresh-token-user-1");
    expect(body.user).toEqual({ id: "user-1", email: "test@example.com" });

    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("senqo_refresh");
  });

  it("rejects duplicate email with 409", async () => {
    findUserByEmailMock.mockResolvedValue(mockUser);

    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("email_already_exists");
  });

  it("rejects invalid email format with 400", async () => {
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "password123",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_payload");
  });

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
});

describe("POST /login", () => {
  it("returns access token and sets refresh cookie with 200", async () => {
    findUserByEmailMock.mockResolvedValue(mockUser);

    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBe("access-token-user-1");
    expect(body.refreshToken).toBe("refresh-token-user-1");
    expect(body.user).toEqual({ id: "user-1", email: "test@example.com" });

    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("senqo_refresh");
  });

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

  it("rejects unknown email with 401", async () => {
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "unknown@example.com",
        password: "password123",
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });
});

describe("POST /refresh", () => {
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

  it("rejects expired or missing refresh token with 401", async () => {
    const res = await app.request("/refresh", {
      method: "POST",
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("no_refresh_token");
  });

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
  it("clears refresh cookie and returns 200 with ok:true", async () => {
    const res = await app.request("/logout", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const setCookieHeader = res.headers.get("Set-Cookie");
    expect(setCookieHeader).toContain("senqo_refresh");
    // Cookie should be cleared (max-age=0 or expired)
    expect(setCookieHeader!.toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/i);
  });
});

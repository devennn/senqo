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
    expect(body.user).toEqual({ id: "user-1", email: "test@example.com", isInstanceAdmin: false });
    expect(provisionOwnerWorkspaceMock).toHaveBeenCalled();
  });

  it("rejects registration when public registration is off and no invite", async () => {
    getAllowPublicRegistrationMock.mockResolvedValue(false);

    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("registration_disabled");
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
    expect(body.user).toEqual({ id: "user-1", email: "test@example.com", isInstanceAdmin: false });

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
    expect(setCookieHeader!.toLowerCase()).toMatch(/max-age=0|expires=thu, 01 jan 1970/i);
  });
});

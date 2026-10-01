import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/auth-jwt.js", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../repositories/auth-users.js", () => ({
  isInstanceAdmin: vi.fn(),
  listAllUsers: vi.fn(),
  countInstanceAdmins: vi.fn(),
  deleteUser: vi.fn(),
  setInstanceAdmin: vi.fn(),
  setUserDisabled: vi.fn(),
}));

vi.mock("../repositories/instance-settings.js", () => ({
  getAllowPublicRegistration: vi.fn(),
  setAllowPublicRegistration: vi.fn(),
}));

vi.mock("../repositories/workspaces.js", () => ({
  listAllWorkspaces: vi.fn(),
  deleteWorkspace: vi.fn(),
}));

vi.mock("../repositories/registration-invites.js", () => ({
  createRegistrationInvite: vi.fn(),
  deleteRegistrationInvite: vi.fn(),
  listPendingRegistrationInvites: vi.fn(),
}));

vi.mock("../services/email.js", () => ({
  sendRegistrationInviteEmail: vi.fn(),
}));

import app from "./admin.js";
import { verifyToken } from "../lib/auth-jwt.js";
import { isInstanceAdmin, listAllUsers } from "../repositories/auth-users.js";
import {
  createRegistrationInvite,
  deleteRegistrationInvite,
  listPendingRegistrationInvites,
} from "../repositories/registration-invites.js";
import { sendRegistrationInviteEmail } from "../services/email.js";

const AUTH = { Authorization: "Bearer admin-token" };
const INVITE = {
  id: "invite-1",
  email: "invitee@example.com",
  created_at: "2026-10-01T00:00:00.000Z",
  expires_at: "2026-10-08T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockResolvedValue({ userId: "admin-1" });
  vi.mocked(isInstanceAdmin).mockResolvedValue(true);
});

describe("GET /users", () => {
  // Registered users and live invites exist → both are returned in one payload, needed so the
  // admin users list can show pending invitees next to real users.
  it("GET /users → returns users and pending invites", async () => {
    vi.mocked(listAllUsers).mockResolvedValue([]);
    vi.mocked(listPendingRegistrationInvites).mockResolvedValue([INVITE]);

    const res = await app.request("/users", { headers: AUTH });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ users: [], pendingInvites: [INVITE] });
  });

  // The request has no token → 401 is returned, needed so the endpoint is never reachable
  // unauthenticated.
  it("GET /users → returns 401 without a token", async () => {
    const res = await app.request("/users");

    expect(res.status).toBe(401);
  });

  // The token belongs to a non-admin → 403 is returned, needed so regular users cannot enumerate
  // the instance.
  it("GET /users → returns 403 for a non-admin", async () => {
    vi.mocked(isInstanceAdmin).mockResolvedValue(false);

    const res = await app.request("/users", { headers: AUTH });

    expect(res.status).toBe(403);
  });
});

describe("POST /registration-invites", () => {
  // Public registration is off and creation succeeds → the created invite is returned with
  // emailSent, needed so the admin UI can append it to the list immediately.
  it("POST /registration-invites → returns the created invite", async () => {
    vi.mocked(createRegistrationInvite).mockResolvedValue({
      ok: true,
      inviteToken: "token-1",
      invite: INVITE,
    });
    vi.mocked(sendRegistrationInviteEmail).mockResolvedValue({ ok: true });

    const res = await app.request("/registration-invites", {
      method: "POST",
      headers: { ...AUTH, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invitee@example.com" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, emailSent: true, invite: INVITE });
    expect(sendRegistrationInviteEmail).toHaveBeenCalledWith({
      to: "invitee@example.com",
      inviteToken: "token-1",
    });
  });
});

describe("DELETE /registration-invites/:id", () => {
  // A live invite matches the id → it is revoked, needed so an invite sent by mistake can be
  // withdrawn from the list.
  it("DELETE /registration-invites/:id → revokes the invite", async () => {
    vi.mocked(deleteRegistrationInvite).mockResolvedValue({ ok: true });

    const res = await app.request("/registration-invites/invite-1", {
      method: "DELETE",
      headers: AUTH,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteRegistrationInvite).toHaveBeenCalledWith("invite-1");
  });

  // No live invite matches the id → 404 is returned, needed so the UI can distinguish an already
  // expired or accepted invite from a server failure.
  it("DELETE /registration-invites/:id → returns 404 when the invite is gone", async () => {
    vi.mocked(deleteRegistrationInvite).mockResolvedValue({
      ok: false,
      message: "invite_not_found",
    });

    const res = await app.request("/registration-invites/missing", {
      method: "DELETE",
      headers: AUTH,
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "invite_not_found" });
  });
});

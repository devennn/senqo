import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockInsertValues = vi.fn();
const mockDeleteReturning = vi.fn();
const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }));

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
  insert: vi.fn(() => ({ values: mockInsertValues })),
  delete: vi.fn(() => ({ where: mockDeleteWhere })),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const { createRegistrationInvite, deleteRegistrationInvite, listPendingRegistrationInvites } =
  (await vi.importActual("../repositories/registration-invites.js")) as typeof import("../repositories/registration-invites.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createRegistrationInvite", () => {
  // No live invite exists for the email → the invite row is inserted and the created invite is
  // returned, needed so the admin UI can list it immediately without a refetch.
  it("createRegistrationInvite → inserts the invite and returns its record when none is pending", async () => {
    mockSelectWhere.mockResolvedValueOnce([]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    const before = Date.now();
    const result = await createRegistrationInvite(" Invitee@Example.com ", "admin-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invite.email).toBe("invitee@example.com");
    expect(result.invite.id).toBeTruthy();
    expect(new Date(result.invite.expires_at).getTime()).toBeGreaterThan(before);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ email: "invitee@example.com", createdByUserId: "admin-1" }),
    );
  });

  // A live pending invite already exists → the duplicate is rejected without inserting, needed so
  // the same address is not invited twice.
  it("createRegistrationInvite → rejects a duplicate while a live invite exists", async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: "existing-invite" }]);

    const result = await createRegistrationInvite("invitee@example.com", "admin-1");

    expect(result).toEqual({ ok: false, message: "invite_already_pending" });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  // The insert fails → ok:false with unexpected_error is returned, needed so the route can respond
  // with a 400/500 instead of throwing.
  it("createRegistrationInvite → returns unexpected_error when the insert fails", async () => {
    mockSelectWhere.mockResolvedValueOnce([]);
    mockInsertValues.mockRejectedValueOnce(new Error("db down"));

    const result = await createRegistrationInvite("invitee@example.com", "admin-1");

    expect(result).toEqual({ ok: false, message: "unexpected_error" });
  });

  // The email is blank after trimming → invalid_email is returned without touching the database,
  // needed so blank submissions never create a row.
  it("createRegistrationInvite → rejects a blank email", async () => {
    const result = await createRegistrationInvite("   ", "admin-1");

    expect(result).toEqual({ ok: false, message: "invalid_email" });
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

describe("listPendingRegistrationInvites", () => {
  // Live invites exist → they are mapped to ISO records, needed so the admin users list can render
  // who is still pending.
  it("listPendingRegistrationInvites → returns live invites as ISO records", async () => {
    const createdAt = new Date("2026-10-01T00:00:00.000Z");
    const expiresAt = new Date("2026-10-08T00:00:00.000Z");
    mockSelectWhere.mockReturnValueOnce({
      orderBy: mockOrderBy.mockResolvedValueOnce([
        { id: "invite-1", email: "invitee@example.com", createdAt, expiresAt },
      ]),
    });

    const result = await listPendingRegistrationInvites();

    expect(result).toEqual([
      {
        id: "invite-1",
        email: "invitee@example.com",
        created_at: "2026-10-01T00:00:00.000Z",
        expires_at: "2026-10-08T00:00:00.000Z",
      },
    ]);
  });

  // The query fails → an empty array is returned gracefully, needed so a transient DB outage does
  // not break the whole admin users response.
  it("listPendingRegistrationInvites → returns an empty list when the query fails", async () => {
    mockSelectWhere.mockReturnValueOnce({
      orderBy: mockOrderBy.mockRejectedValueOnce(new Error("db down")),
    });

    const result = await listPendingRegistrationInvites();

    expect(result).toEqual([]);
  });
});

describe("deleteRegistrationInvite", () => {
  // A pending invite row is deleted → ok:true is returned, needed so the admin can revoke an invite
  // sent by mistake.
  it("deleteRegistrationInvite → returns ok when a pending invite is deleted", async () => {
    mockDeleteReturning.mockResolvedValueOnce([{ id: "invite-1" }]);

    const result = await deleteRegistrationInvite("invite-1");

    expect(result).toEqual({ ok: true });
  });

  // No pending invite matches the id → invite_not_found is returned, needed so the route responds
  // with 404 instead of pretending the revocation worked.
  it("deleteRegistrationInvite → returns invite_not_found when nothing was deleted", async () => {
    mockDeleteReturning.mockResolvedValueOnce([]);

    const result = await deleteRegistrationInvite("missing");

    expect(result).toEqual({ ok: false, message: "invite_not_found" });
  });

  // The delete fails → unexpected_error is returned, needed so the route can surface a 500.
  it("deleteRegistrationInvite → returns unexpected_error when the delete fails", async () => {
    mockDeleteReturning.mockRejectedValueOnce(new Error("db down"));

    const result = await deleteRegistrationInvite("invite-1");

    expect(result).toEqual({ ok: false, message: "unexpected_error" });
  });
});

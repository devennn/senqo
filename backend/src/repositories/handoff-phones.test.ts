import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("../db/index.js", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handoff-phones repository", () => {
  // Pending phone upsert inserts when no row exists yet for that connection.
  it("upsertHandoffPhonePending → inserts when phone row is missing", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const { upsertHandoffPhonePending } = await import("./handoff-phones.js");
    const result = await upsertHandoffPhonePending("ws-1", "user-1", "conn-1", "15551234567");
    expect(result).toEqual({ ok: true });
    expect(mockInsert).toHaveBeenCalled();
  });

  // Mark verified updates status so the notify dropdown can list the teammate.
  it("markHandoffPhoneVerified → returns ok true after update", async () => {
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { markHandoffPhoneVerified } = await import("./handoff-phones.js");
    const result = await markHandoffPhoneVerified("ws-1", "user-1", "conn-1", "15551234567");
    expect(result).toEqual({ ok: true });
  });

  // Clear removes phone and verification rows for that connection only.
  it("clearHandoffPhone → deletes phone and verification rows", async () => {
    mockDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const { clearHandoffPhone } = await import("./handoff-phones.js");
    const result = await clearHandoffPhone("ws-1", "user-1", "conn-1");
    expect(result).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });

  // Unexpected DB failure on insert is reported as ok:false.
  it("upsertHandoffPhonePending → returns ok false on insert error", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockInsert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error("db down")),
    });

    const { upsertHandoffPhonePending } = await import("./handoff-phones.js");
    const result = await upsertHandoffPhonePending("ws-1", "user-1", "conn-1", "15551234567");
    expect(result.ok).toBe(false);
  });
});

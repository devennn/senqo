import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("../db/index.js", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("error-alert-subscribers repository", () => {
  // The error handoff reads this list to decide who gets the WhatsApp alert.
  it("listErrorAlertSubscriberUserIds returns subscribed user ids", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]),
      }),
    });

    const { listErrorAlertSubscriberUserIds } = await import("./error-alert-subscribers.js");
    const result = await listErrorAlertSubscriberUserIds("ws-1");

    expect(result).toEqual(["user-1", "user-2"]);
  });

  // Enabling adds the row; duplicate submits must not fail.
  it("setErrorAlertSubscriber inserts and ignores conflicts when enabling", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    mockInsert.mockReturnValue({ values });

    const { setErrorAlertSubscriber } = await import("./error-alert-subscribers.js");
    const result = await setErrorAlertSubscriber("ws-1", "user-1", true);

    expect(result).toEqual({ ok: true });
    expect(values).toHaveBeenCalledWith({ workspaceId: "ws-1", userId: "user-1" });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  // Disabling removes the subscription so the member stops receiving alerts.
  it("setErrorAlertSubscriber deletes the row when disabling", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where });

    const { setErrorAlertSubscriber } = await import("./error-alert-subscribers.js");
    const result = await setErrorAlertSubscriber("ws-1", "user-1", false);

    expect(result).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // Unexpected DB failures surface as ok:false so the route can return an error.
  it("setErrorAlertSubscriber returns ok false on insert error", async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockRejectedValue(new Error("db down")),
      }),
    });

    const { setErrorAlertSubscriber } = await import("./error-alert-subscribers.js");
    const result = await setErrorAlertSubscriber("ws-1", "user-1", true);

    expect(result.ok).toBe(false);
  });

  // A read failure must not crash the failure handoff; it degrades to no recipients.
  it("listErrorAlertSubscriberUserIds returns empty list on read error", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("db down")),
      }),
    });

    const { listErrorAlertSubscriberUserIds } = await import("./error-alert-subscribers.js");
    const result = await listErrorAlertSubscriberUserIds("ws-1");

    expect(result).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../db/index.js", () => ({
  db: mockDb,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin-chat repository", () => {
  describe("createAdminChatMessage", () => {
    // A stored chat message is returned with an ISO created_at string, needed
    // so the UI can render the message with its timestamp shape.
    it("returns the saved message record", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "m1", role: "user", content: "Hello", createdAt },
          ]),
        }),
      });

      const { createAdminChatMessage } = await import("./admin-chat.js");
      const result = await createAdminChatMessage("admin-1", "user", "Hello");

      expect(result).toEqual({
        id: "m1",
        role: "user",
        content: "Hello",
        created_at: "2026-01-01T00:00:00.000Z",
      });
    });

    // The insert fails → null is returned so the route can report a failure
    // instead of silently dropping the message.
    it("returns null on a database error", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("DB error")),
      });

      const { createAdminChatMessage } = await import("./admin-chat.js");
      const result = await createAdminChatMessage("admin-1", "user", "Hello");

      expect(result).toBeNull();
    });
  });

  describe("listAdminChatMessages", () => {
    // Rows come back oldest-first and are capped to the requested limit.
    it("returns messages oldest-first", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { id: "m1", role: "user", content: "A", createdAt: new Date(0) },
              { id: "m2", role: "assistant", content: "B", createdAt: new Date(1) },
            ]),
          }),
        }),
      });

      const { listAdminChatMessages } = await import("./admin-chat.js");
      const result = await listAdminChatMessages("admin-1", 200);

      expect(result.map((m) => m.id)).toEqual(["m1", "m2"]);
    });

    // The query fails → an empty list is returned so the chat still renders.
    it("returns an empty list on a database error", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error("DB error")),
          }),
        }),
      });

      const { listAdminChatMessages } = await import("./admin-chat.js");
      const result = await listAdminChatMessages("admin-1", 200);

      expect(result).toEqual([]);
    });
  });

  describe("deleteAdminChatMessages", () => {
    // A successful delete returns ok so the route can confirm clearing.
    it("returns ok on success", async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const { deleteAdminChatMessages } = await import("./admin-chat.js");
      const result = await deleteAdminChatMessages("admin-1");

      expect(result).toEqual({ ok: true });
    });

    // The delete fails → ok:false so the UI does not clear the chat on a
    // failed request.
    it("returns ok false on a database error", async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("DB error")),
      });

      const { deleteAdminChatMessages } = await import("./admin-chat.js");
      const result = await deleteAdminChatMessages("admin-1");

      expect(result).toEqual({ ok: false, message: "unexpected_error" });
    });
  });
});

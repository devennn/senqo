import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn((template: string) => template);
Object.assign(mockSql, { raw: vi.fn() });

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn(),
};

vi.mock("../db/index.js", () => ({
  db: mockDb,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("contacts repository", () => {
  describe("createContact", () => {
    it("inserts and returns ok true", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const { createContact } = await import("../repositories/contacts.js");
      const result = await createContact({
        workspace_id: "ws-1",
        first_name: "John",
        last_name: "Doe",
        phone: "1234567890",
        metadata: null,
      });

      expect(result.ok).toBe(true);
      expect(result.message).toBe("Contact added");
    });

    it("returns ok false on DB error", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("DB error")),
      });

      const { createContact } = await import("../repositories/contacts.js");
      const result = await createContact({
        workspace_id: "ws-1",
        first_name: "John",
        last_name: "Doe",
        phone: "1234567890",
        metadata: null,
      });

      expect(result.ok).toBe(false);
    });
  });

  describe("createContactsBulk", () => {
    it("inserts multiple rows and returns ok true", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const { createContactsBulk } = await import("../repositories/contacts.js");
      const result = await createContactsBulk([
        { workspace_id: "ws-1", first_name: "John", last_name: "Doe", phone: "111", metadata: null },
        { workspace_id: "ws-1", first_name: "Jane", last_name: "Doe", phone: "222", metadata: null },
      ]);

      expect(result.ok).toBe(true);
      expect(result.message).toBe("Imported 2 contacts");
    });

    it("returns ok false on DB error", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("DB error")),
      });

      const { createContactsBulk } = await import("../repositories/contacts.js");
      const result = await createContactsBulk([
        { workspace_id: "ws-1", first_name: "John", last_name: "Doe", phone: "111", metadata: null },
      ]);

      expect(result.ok).toBe(false);
    });
  });

  describe("updateContactIsTest", () => {
    it("toggles is_test column and returns ok true", async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const { updateContactIsTest } = await import("../repositories/contacts.js");
      const result = await updateContactIsTest("ws-1", "contact-1", true);

      expect(result.ok).toBe(true);
    });

    it("returns ok false on DB error", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB error"));

      const { updateContactIsTest } = await import("../repositories/contacts.js");
      const result = await updateContactIsTest("ws-1", "contact-1", true);

      expect(result.ok).toBe(false);
    });
  });

  describe("listContactOptions", () => {
    it("returns formatted labels", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "c1", firstName: "John", lastName: "Doe", phone: "123" },
              { id: "c2", firstName: "Jane", lastName: "Smith", phone: "456" },
            ]),
          }),
        }),
      });
      mockDb.select = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const { listContactOptions } = await import("../repositories/contacts.js");
      const result = await listContactOptions("ws-1");

      expect(result).toHaveLength(2);
      expect(result[0]?.label).toBe("John Doe (123)");
      expect(result[1]?.label).toBe("Jane Smith (456)");
    });

    it("returns empty array on DB error", async () => {
      const mockFromErr = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("DB error")),
          }),
        }),
      });
      mockDb.select = vi.fn().mockReturnValue({
        from: mockFromErr,
      });

      const { listContactOptions } = await import("../repositories/contacts.js");
      const result = await listContactOptions("ws-1");

      expect(result).toEqual([]);
    });
  });

  describe("getContactIsTestForConversation", () => {
    it("returns false when no row found", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      });
      const mockFrom = vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      });
      mockDb.select = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const { getContactIsTestForConversation } = await import("../repositories/contacts.js");
      const result = await getContactIsTestForConversation("ws-1", "conv-1");

      expect(result).toBe(false);
    });

    it("returns true when contact is_test is true", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ isTest: true }]),
      });
      const mockFrom = vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      });
      mockDb.select = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      const { getContactIsTestForConversation } = await import("../repositories/contacts.js");
      const result = await getContactIsTestForConversation("ws-1", "conv-1");

      expect(result).toBe(true);
    });
  });
});

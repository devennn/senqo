import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOrderBy = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockLimit = vi.fn();
const mockReturning = vi.fn();

const mockDb = {
  select: vi.fn().mockReturnValue({ from: mockFrom }),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: mockReturning }) }),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const { listConversationLabels, createConversationLabel, validateLabelIdsForWorkspace } =
  await vi.importActual("../repositories/conversation-labels.js") as typeof import("../repositories/conversation-labels.js");

beforeEach(() => { vi.clearAllMocks(); });

describe("listConversationLabels", () => {
  it("returns all labels for workspace", async () => {
    const rows = [
      { id: "l1", workspaceId: "ws-1", name: "VIP", description: "Important", createdAt: new Date(), updatedAt: new Date() },
    ];
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue({ orderBy: mockOrderBy }) });
    mockOrderBy.mockResolvedValue(rows);
    const result = await listConversationLabels("ws-1");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("VIP");
  });

  it("returns empty on error", async () => {
    mockFrom.mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockRejectedValue(new Error("fail")) }) });
    const result = await listConversationLabels("ws-1");
    expect(result).toEqual([]);
  });
});

describe("createConversationLabel", () => {
  it("inserts and returns id", async () => {
    mockReturning.mockResolvedValue([{ id: "new-label" }]);
    const result = await createConversationLabel({ workspaceId: "ws-1", name: "Tag", description: "" });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("new-label");
  });

  it("returns ok false on duplicate (Error with 'duplicate' in message)", async () => {
    mockReturning.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    const result = await createConversationLabel({ workspaceId: "ws-1", name: "Tag", description: "" });
    expect(result.ok).toBe(false);
  });
});

describe("validateLabelIdsForWorkspace", () => {
  it("returns true when all IDs valid", async () => {
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue(Promise.resolve([{ id: "l1" }, { id: "l2" }])) });
    const result = await validateLabelIdsForWorkspace("ws-1", ["l1", "l2"]);
    expect(result).toBe(true);
  });

  it("returns false when some IDs missing", async () => {
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue(Promise.resolve([{ id: "l1" }])) });
    const result = await validateLabelIdsForWorkspace("ws-1", ["l1", "l2"]);
    expect(result).toBe(false);
  });
});

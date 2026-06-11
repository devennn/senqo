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
  // Labels exist for the workspace → they are returned as an array, needed to verify the listing query produces the correct label data.
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

  // Database query fails → empty array is returned gracefully, needed to avoid crashing callers during transient DB outages.
  it("returns empty on error", async () => {
    mockFrom.mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockRejectedValue(new Error("fail")) }) });
    const result = await listConversationLabels("ws-1");
    expect(result).toEqual([]);
  });
});

describe("createConversationLabel", () => {
  // A valid label name is provided → insert succeeds returning ok:true with the new id, needed to confirm label creation happy path.
  it("inserts and returns id", async () => {
    mockReturning.mockResolvedValue([{ id: "new-label" }]);
    const result = await createConversationLabel({ workspaceId: "ws-1", name: "Tag", description: "" });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("new-label");
  });

  // Duplicate label name causes a constraint violation → ok:false is returned, needed to ensure duplicate names are rejected gracefully.
  it("returns ok false on duplicate (Error with 'duplicate' in message)", async () => {
    mockReturning.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    const result = await createConversationLabel({ workspaceId: "ws-1", name: "Tag", description: "" });
    expect(result.ok).toBe(false);
  });
});

describe("validateLabelIdsForWorkspace", () => {
  // All provided label IDs exist in the workspace → true is returned, needed to confirm successful validation before assigning labels.
  it("returns true when all IDs valid", async () => {
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue(Promise.resolve([{ id: "l1" }, { id: "l2" }])) });
    const result = await validateLabelIdsForWorkspace("ws-1", ["l1", "l2"]);
    expect(result).toBe(true);
  });

  // Some provided label IDs are missing from the workspace → false is returned, needed to prevent assigning non-existent labels.
  it("returns false when some IDs missing", async () => {
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue(Promise.resolve([{ id: "l1" }])) });
    const result = await validateLabelIdsForWorkspace("ws-1", ["l1", "l2"]);
    expect(result).toBe(false);
  });
});

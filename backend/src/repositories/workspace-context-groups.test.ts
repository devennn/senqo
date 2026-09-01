import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

const mockDb = {
  select: vi.fn().mockReturnValue({ from: mockFrom }),
  update: vi.fn().mockReturnValue({ set: mockSet }),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const payload = {
  workspaceId: "ws-1",
  groupId: "group-1",
  entryId: "entry-1",
  title: "Hours",
  bodyText: "Open 9–6",
};

describe("updateWorkspaceContextEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  // Group and entry both exist → update succeeds with ok:true, needed so Save persists an existing context fact.
  it("returns ok true when group and entry exist", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]).mockResolvedValueOnce([{ id: "entry-1" }]);

    const { updateWorkspaceContextEntry } = await import("./workspace-context-groups.js");
    const result = await updateWorkspaceContextEntry(payload);
    expect(result).toEqual({ ok: true });
  });

  // Group exists but entry select is empty → Entry not found, needed so Save does not update a missing fact.
  it("returns Entry not found when entry select is empty", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]).mockResolvedValueOnce([]);

    const { updateWorkspaceContextEntry } = await import("./workspace-context-groups.js");
    const result = await updateWorkspaceContextEntry(payload);
    expect(result).toEqual({ ok: false, message: "Entry not found." });
  });
});

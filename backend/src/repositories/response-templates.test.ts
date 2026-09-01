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
  questionText: "What are your hours?",
  answerText: "9–6 SGT",
};

describe("updateWorkspaceResponseTemplateEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  // Group and template both exist → update succeeds with ok:true, needed so Save persists an existing Q&A pair.
  it("returns ok true when group and entry exist", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]).mockResolvedValueOnce([{ id: "entry-1" }]);

    const { updateWorkspaceResponseTemplateEntry } = await import("./response-templates.js");
    const result = await updateWorkspaceResponseTemplateEntry(payload);
    expect(result).toEqual({ ok: true });
  });

  // Group exists but entry select is empty → Template not found, needed so Save does not update a missing template.
  it("returns Template not found when entry select is empty", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "group-1" }]).mockResolvedValueOnce([]);

    const { updateWorkspaceResponseTemplateEntry } = await import("./response-templates.js");
    const result = await updateWorkspaceResponseTemplateEntry(payload);
    expect(result).toEqual({ ok: false, message: "Template not found." });
  });
});

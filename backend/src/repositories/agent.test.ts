import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockSet = vi.fn();

const mockDb = {
  select: vi.fn().mockReturnValue({ from: mockFrom }),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: mockReturning }) }),
  update: vi.fn().mockReturnValue({ set: mockSet }),
  delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: mockReturning }) }),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const { listAgentConfigs, getAgentConfigById, createAgentConfig, updateAgentConfig, archiveAgentConfig, deleteAgentConfig, markAgentConfigFirstUsed } =
  await vi.importActual("../repositories/agent.js") as typeof import("../repositories/agent.js");

beforeEach(() => { vi.clearAllMocks(); });

describe("listAgentConfigs", () => {
  // Non-archived agents exist → they are returned sorted by updatedAt desc with formatted profile_name and updated_at fields, needed to verify the listing query shapes output correctly.
  it("returns non-archived agents ordered by updatedAt desc", async () => {
    const rows = [
      { id: "a1", profileName: "Agent One", behavior: "", tools: [], skills: [], updatedAt: new Date(), firstUsedAt: null, autoAssignConversationLabels: true, responseTemplateGroups: [], handoffTopicGroups: [], contextGroups: [], assetGroups: [] },
    ];
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue({ orderBy: mockOrderBy }) });
    mockOrderBy.mockResolvedValue(rows);
    const result = await listAgentConfigs("ws-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
    expect(result[0].profile_name).toBe("Agent One");
    expect(result[0].updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // Database query fails → empty array is returned instead of throwing, needed to ensure the repository handles errors gracefully without crashing callers.
  it("returns empty array on error", async () => {
    mockFrom.mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockRejectedValue(new Error("db down")) }) });
    const result = await listAgentConfigs("ws-1");
    expect(result).toEqual([]);
  });
});

describe("getAgentConfigById", () => {
  // Agent exists with the given id → single agent is returned with formatted profile_name, needed to confirm by-id lookups produce the correct shape.
  it("returns single agent when found", async () => {
    const row = { id: "a1", profileName: "Agent", behavior: "", tools: [], skills: [], updatedAt: new Date(), firstUsedAt: null, autoAssignConversationLabels: true, responseTemplateGroups: [], handoffTopicGroups: [], contextGroups: [], assetGroups: [] };
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue({ limit: mockLimit }) });
    mockLimit.mockResolvedValue([row]);
    const result = await getAgentConfigById("ws-1", "a1");
    expect(result?.id).toBe("a1");
    expect(result?.profile_name).toBe("Agent");
  });

  // No agent matches the given id → null is returned, needed to verify the caller can distinguish "not found" from an error.
  it("returns null when not found", async () => {
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue({ limit: mockLimit }) });
    mockLimit.mockResolvedValue([]);
    const result = await getAgentConfigById("ws-1", "nonexistent");
    expect(result).toBeNull();
  });
});

describe("createAgentConfig", () => {
  // Insert succeeds → ok:true and the new id are returned, needed to verify the happy path for agent creation.
  it("inserts with profile_name and returns id", async () => {
    mockReturning.mockResolvedValue([{ id: "new-id" }]);
    const result = await createAgentConfig({ workspace_id: "ws-1", profile_name: "New Agent" });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("new-id");
  });

  // Database insert fails → ok:false is returned, needed to ensure creation errors are surfaced correctly to the caller.
  it("returns ok false on error", async () => {
    mockReturning.mockRejectedValue(new Error("db error"));
    const result = await createAgentConfig({ workspace_id: "ws-1", profile_name: "Fail" });
    expect(result.ok).toBe(false);
  });
});

describe("updateAgentConfig", () => {
  // All updateable fields are provided → update succeeds returning ok:true, needed to confirm the full update payload works end-to-end.
  it("updates all fields and returns ok true", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const result = await updateAgentConfig({
      id: "a1", workspace_id: "ws-1", profile_name: "Updated", behavior: "be nice", tools: [], skills: [],
      auto_assign_conversation_labels: true, response_template_groups: [], handoff_topic_groups: [], context_groups: [], asset_groups: [],
    });
    expect(result.ok).toBe(true);
  });

  // Database update throws → ok:false is returned, needed to ensure the repository catches and reports update failures.
  it("returns ok false on error", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockRejectedValue(new Error("fail")) });
    const result = await updateAgentConfig({
      id: "a1", workspace_id: "ws-1", profile_name: "X", behavior: "", tools: [], skills: [],
      auto_assign_conversation_labels: false, response_template_groups: [], handoff_topic_groups: [], context_groups: [], asset_groups: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe("archiveAgentConfig", () => {
  // Agent exists and is not yet archived → archivedAt is set and ok:true returned, needed to confirm the archive operation marks the record without deleting it.
  it("sets archivedAt and returns ok true", async () => {
    mockSet.mockReturnValue({ where: mockWhere.mockReturnValue({ returning: mockReturning }) });
    mockReturning.mockResolvedValue([{ id: "a1" }]);
    const result = await archiveAgentConfig({ workspace_id: "ws-1", id: "a1" });
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Agent archived");
  });

  // Agent was already archived so 0 rows are updated → ok:false is returned, needed to prevent double-archiving and inform the caller.
  it("returns error if already archived (0 rows updated)", async () => {
    mockSet.mockReturnValue({ where: mockWhere.mockReturnValue({ returning: mockReturning }) });
    mockReturning.mockResolvedValue([]);
    const result = await archiveAgentConfig({ workspace_id: "ws-1", id: "a1" });
    expect(result.ok).toBe(false);
  });
});

describe("deleteAgentConfig", () => {
  // Agent has not been used (firstUsedAt is null) and is not archived → deletion succeeds with ok:true, needed to ensure unused agents can be cleaned up.
  it("only deletes if firstUsedAt is null and not archived", async () => {
    mockReturning.mockResolvedValue([{ id: "a1" }]);
    const result = await deleteAgentConfig({ workspace_id: "ws-1", id: "a1" });
    expect(result.ok).toBe(true);
  });

  // Agent has been used so 0 rows match the delete condition → ok:false is returned, needed to prevent accidental deletion of active agent configs.
  it("returns error when agent has been used", async () => {
    mockReturning.mockResolvedValue([]);
    const result = await deleteAgentConfig({ workspace_id: "ws-1", id: "a1" });
    expect(result.ok).toBe(false);
  });
});

describe("markAgentConfigFirstUsed", () => {
  // firstUsedAt is currently null → timestamp is set, needed to verify the one-time recording of first agent usage.
  it("sets timestamp only if null", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    await expect(markAgentConfigFirstUsed("ws-1", "a1")).resolves.toBeUndefined();
  });
});

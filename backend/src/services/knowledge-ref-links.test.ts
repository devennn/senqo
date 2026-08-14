import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSkill = vi.fn();
const mockGetContextEntry = vi.fn();
const mockGetContextGroup = vi.fn();
const mockGetTemplateEntry = vi.fn();
const mockGetTemplateGroup = vi.fn();
const mockGetHandoffGroup = vi.fn();

vi.mock("../repositories/skills.js", () => ({
  getWorkspaceSkillById: (...args: unknown[]) => mockGetSkill(...args),
}));

vi.mock("../repositories/workspace-context-groups.js", () => ({
  getWorkspaceContextEntryForEval: (...args: unknown[]) => mockGetContextEntry(...args),
  getWorkspaceContextGroupDetail: (...args: unknown[]) => mockGetContextGroup(...args),
}));

vi.mock("../repositories/response-templates.js", () => ({
  getWorkspaceResponseTemplateEntryForEval: (...args: unknown[]) => mockGetTemplateEntry(...args),
  getWorkspaceResponseTemplateGroupDetail: (...args: unknown[]) => mockGetTemplateGroup(...args),
}));

vi.mock("../repositories/handoff-topic-groups.js", () => ({
  getWorkspaceHandoffTopicGroupDetail: (...args: unknown[]) => mockGetHandoffGroup(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveKnowledgeRefLinks", () => {
  // Live knowledge still in the workspace → return a dashboard href operators can open.
  it("returns href when the knowledge item still exists", async () => {
    mockGetContextEntry.mockResolvedValue({ id: "ctx-e1", groupId: "ctx-g1" });
    const { resolveKnowledgeRefLinks } = await import("./knowledge-ref-links.js");
    const links = await resolveKnowledgeRefLinks("ws-1", [
      { kind: "context", id: "ctx-e1", groupId: "ctx-g1" },
    ]);
    expect(links).toEqual([
      {
        kind: "context",
        id: "ctx-e1",
        href: "/knowledge?contextGroupId=ctx-g1&contextEntryId=ctx-e1",
      },
    ]);
  });

  // Deleted knowledge must not be clickable, even if the chip label remains on the message.
  it("returns href null when the knowledge item was deleted", async () => {
    mockGetSkill.mockResolvedValue(null);
    const { resolveKnowledgeRefLinks } = await import("./knowledge-ref-links.js");
    const links = await resolveKnowledgeRefLinks("ws-1", [
      { kind: "skill", id: "sk-gone" },
    ]);
    expect(links).toEqual([{ kind: "skill", id: "sk-gone", href: null }]);
  });
});

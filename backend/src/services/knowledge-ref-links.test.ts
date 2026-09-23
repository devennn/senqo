import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSkill = vi.fn();
const mockGetContextEntry = vi.fn();
const mockGetContextGroup = vi.fn();
const mockGetTemplateEntry = vi.fn();
const mockGetTemplateGroup = vi.fn();
const mockGetHandoffEntry = vi.fn();
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
  getWorkspaceHandoffTopicEntryForEval: (...args: unknown[]) => mockGetHandoffEntry(...args),
  getWorkspaceHandoffTopicGroupDetail: (...args: unknown[]) => mockGetHandoffGroup(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveKnowledgeRefLinks", () => {
  // Entry still in workspace → link opens the group with that fact expanded.
  it("returns entry deep-link when the context fact still exists", async () => {
    mockGetContextEntry.mockResolvedValue({ id: "ctx-e1", groupId: "ctx-g1" });
    const { resolveKnowledgeRefLinks } = await import("./knowledge-ref-links.js");
    const links = await resolveKnowledgeRefLinks("ws-1", [
      { kind: "context", id: "ctx-e1", groupId: "ctx-g1" },
    ]);
    expect(links).toEqual([
      {
        kind: "context",
        id: "ctx-e1",
        href: "/knowledge?tab=context&contextGroupId=ctx-g1&contextEntryId=ctx-e1",
      },
    ]);
  });

  // Missing groupId on the chip must still expand the fact when the id is an entry.
  it("resolves context entry group from the database when groupId is omitted", async () => {
    mockGetContextEntry.mockResolvedValue({ id: "ctx-e1", groupId: "ctx-g1" });
    const { resolveKnowledgeRefLinks } = await import("./knowledge-ref-links.js");
    const links = await resolveKnowledgeRefLinks("ws-1", [{ kind: "context", id: "ctx-e1" }]);
    expect(links).toEqual([
      {
        kind: "context",
        id: "ctx-e1",
        href: "/knowledge?tab=context&contextGroupId=ctx-g1&contextEntryId=ctx-e1",
      },
    ]);
    expect(mockGetContextGroup).not.toHaveBeenCalled();
  });

  // Group-level cite opens the group without an entry expand param.
  it("returns group-only href when the id is a context group", async () => {
    mockGetContextEntry.mockResolvedValue(null);
    mockGetContextGroup.mockResolvedValue({ id: "ctx-g1", name: "Policies" });
    const { resolveKnowledgeRefLinks } = await import("./knowledge-ref-links.js");
    const links = await resolveKnowledgeRefLinks("ws-1", [
      { kind: "context", id: "ctx-g1", groupId: "ctx-g1" },
    ]);
    expect(links).toEqual([
      {
        kind: "context",
        id: "ctx-g1",
        href: "/knowledge?tab=context&contextGroupId=ctx-g1",
      },
    ]);
  });

  // Template entry deep-link includes tab + expand params.
  it("returns template entry deep-link when the entry still exists", async () => {
    mockGetTemplateEntry.mockResolvedValue({ id: "tpl-e1", groupId: "tpl-g1" });
    const { resolveKnowledgeRefLinks } = await import("./knowledge-ref-links.js");
    const links = await resolveKnowledgeRefLinks("ws-1", [
      { kind: "template", id: "tpl-e1", groupId: "tpl-g1" },
    ]);
    expect(links).toEqual([
      {
        kind: "template",
        id: "tpl-e1",
        href: "/knowledge?tab=templates&templateGroupId=tpl-g1&templateEntryId=tpl-e1",
      },
    ]);
  });

  // Handoff topic deep-link expands the topic card.
  it("returns handoff entry deep-link when the topic still exists", async () => {
    mockGetHandoffEntry.mockResolvedValue({ id: "ho-e1", groupId: "ho-g1" });
    const { resolveKnowledgeRefLinks } = await import("./knowledge-ref-links.js");
    const links = await resolveKnowledgeRefLinks("ws-1", [
      { kind: "handoff", id: "ho-e1", groupId: "ho-g1" },
    ]);
    expect(links).toEqual([
      {
        kind: "handoff",
        id: "ho-e1",
        href: "/knowledge?tab=handoff&handoffGroupId=ho-g1&handoffEntryId=ho-e1",
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

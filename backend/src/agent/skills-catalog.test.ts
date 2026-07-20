import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockListHandoff = vi.fn();
const mockListTemplates = vi.fn();
const mockListContext = vi.fn();
const mockListAssets = vi.fn();
const mockListLabels = vi.fn();
const mockListCustomTools = vi.fn();

vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: (...args: unknown[]) => mockGetAgent(...args),
}));

vi.mock("../repositories/handoff-topic-groups.js", () => ({
  listHandoffTopicsForInstructions: (...args: unknown[]) => mockListHandoff(...args),
}));

vi.mock("../repositories/response-templates.js", () => ({
  listResponseTemplatesForInstructions: (...args: unknown[]) => mockListTemplates(...args),
}));

vi.mock("../repositories/workspace-context-groups.js", () => ({
  listWorkspaceContextForInstructions: (...args: unknown[]) => mockListContext(...args),
}));

vi.mock("../repositories/workspace-asset-groups.js", () => ({
  listWorkspaceAssetsForInstructions: (...args: unknown[]) => mockListAssets(...args),
}));

vi.mock("../repositories/conversation-labels.js", () => ({
  listConversationLabels: (...args: unknown[]) => mockListLabels(...args),
}));

vi.mock("../repositories/skills.js", () => ({
  listActiveWorkspaceSkills: vi.fn(),
  findWorkspaceSkillByNameOrKey: vi.fn(),
  readWorkspaceSkillContent: vi.fn(),
}));

vi.mock("../repositories/workspace-custom-tools.js", () => ({
  listWorkspaceCustomToolsByKeys: (...args: unknown[]) => mockListCustomTools(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListTemplates.mockResolvedValue([]);
  mockListContext.mockResolvedValue([]);
  mockListAssets.mockResolvedValue([]);
  mockListLabels.mockResolvedValue([]);
  mockListCustomTools.mockResolvedValue([]);
});

describe("formatHandoffTopicsInstruction", () => {
  // Selected groups become prompt guidance the agent follows for handoff_to_human.
  it("formats marked handoff groups into Handoff Guidance bullets", async () => {
    const { formatHandoffTopicsInstruction } = await import("./skills-catalog.js");
    const text = formatHandoffTopicsInstruction([
      {
        name: "Billing",
        entries: [{ topic: "Refunds", description: "Customer wants money back" }],
      },
    ]);
    expect(text).toContain("call `handoff_to_human`");
    expect(text).toContain("#### Billing");
    expect(text).toContain('"Refunds"');
    expect(text).toContain("Customer wants money back");
  });

  // Empty selection must not inject topic bullets into the prompt.
  it("returns empty string when no groups are selected", async () => {
    const { formatHandoffTopicsInstruction } = await import("./skills-catalog.js");
    expect(formatHandoffTopicsInstruction([])).toBe("");
  });
});

describe("buildAgentInstructions handoff topics", () => {
  // Agent.handoff_topic_groups from Profile → Knowledge must appear under Handoff Guidance.
  it("includes selected handoff topic groups in the system prompt", async () => {
    mockGetAgent.mockResolvedValue({
      id: "agent-1",
      profile_name: "Bot",
      behavior: "Be helpful",
      tools: [],
      skills: [],
      response_template_groups: [],
      handoff_topic_groups: ["hg-1"],
      context_groups: [],
      asset_groups: [],
      auto_assign_conversation_labels: false,
    });
    mockListHandoff.mockResolvedValue([
      {
        name: "Escalations",
        entries: [{ topic: "Legal threat", description: "Escalate immediately" }],
      },
    ]);

    const { buildAgentInstructions } = await import("./skills-catalog.js");
    const prompt = await buildAgentInstructions("ws-1", "agent-1");

    expect(mockListHandoff).toHaveBeenCalledWith("ws-1", ["hg-1"]);
    expect(prompt).toContain("### Handoff Guidance");
    expect(prompt).toContain("#### Escalations");
    expect(prompt).toContain('"Legal threat"');
    expect(prompt).toContain("Escalate immediately");
  });

  // Unmarked agent (empty handoff_topic_groups) must not load or inject topics.
  it("omits handoff topic content when agent has no groups selected", async () => {
    mockGetAgent.mockResolvedValue({
      id: "agent-1",
      profile_name: "Bot",
      behavior: "",
      tools: [],
      skills: [],
      response_template_groups: [],
      handoff_topic_groups: [],
      context_groups: [],
      asset_groups: [],
      auto_assign_conversation_labels: false,
    });
    mockListHandoff.mockResolvedValue([]);

    const { buildAgentInstructions } = await import("./skills-catalog.js");
    const prompt = await buildAgentInstructions("ws-1", "agent-1");

    expect(mockListHandoff).toHaveBeenCalledWith("ws-1", []);
    expect(prompt).toContain("### Handoff Guidance");
    expect(prompt).not.toContain("#### ");
    expect(prompt).not.toContain("call `handoff_to_human` and pass a short");
  });
});

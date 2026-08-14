import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockListHandoff = vi.fn();
const mockListTemplates = vi.fn();
const mockListContext = vi.fn();
const mockListAssets = vi.fn();
const mockListLabels = vi.fn();
const mockListLabelBadges = vi.fn();
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
  listLabelBadgesForConversations: (...args: unknown[]) => mockListLabelBadges(...args),
}));

const mockListSkills = vi.fn();

vi.mock("../repositories/skills.js", () => ({
  listActiveWorkspaceSkills: (...args: unknown[]) => mockListSkills(...args),
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
  mockListLabelBadges.mockResolvedValue(new Map());
  mockListHandoff.mockResolvedValue([]);
  mockListCustomTools.mockResolvedValue([]);
  mockListSkills.mockResolvedValue([]);
});

describe("formatConversationLabelsInstruction", () => {
  // Multi-intent / multi-topic threads need explicit multi-label and recent-history rules.
  it("instructs multi-label assignment using recent thread context", async () => {
    const { formatConversationLabelsInstruction } = await import("./skills-catalog.js");
    const text = formatConversationLabelsInstruction(
      [
        {
          id: "lbl-delivery",
          workspace_id: "ws-1",
          name: "Delivery",
          description: "Food delivery platforms",
          created_at: "",
          updated_at: "",
        },
        {
          id: "lbl-menu",
          workspace_id: "ws-1",
          name: "Menu",
          description: "Menu questions",
          created_at: "",
          updated_at: "",
        },
      ],
      [{ id: "lbl-delivery", name: "Delivery", source: "ai" }],
    );

    expect(text).toContain("previous 10 messages");
    expect(text).toContain("multiple intents");
    expect(text).toContain("full set");
    expect(text).toContain("definition");
    expect(text).toContain("not the name alone");
    expect(text).toContain("MUST call `apply_conversation_labels`");
    expect(text).toContain("Do not answer and skip labeling");
    expect(text).toContain("lbl-delivery");
    expect(text).toContain("lbl-menu");
    expect(text).toContain('Currently on this conversation:');
    expect(text).toContain('source=ai');
  });

  // Empty catalog must not inject label guidance into the prompt.
  it("returns empty string when workspace has no labels", async () => {
    const { formatConversationLabelsInstruction } = await import("./skills-catalog.js");
    expect(formatConversationLabelsInstruction([])).toBe("");
  });
});

describe("buildAgentInstructions conversation labels", () => {
  // Auto-assign on must inject catalog + current conversation labels for the session.
  it("includes catalog and current labels when auto-assign is enabled", async () => {
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
      auto_assign_conversation_labels: true,
    });
    mockListLabels.mockResolvedValue([
      {
        id: "lbl-vip",
        workspace_id: "ws-1",
        name: "VIP",
        description: "High-value customer",
        created_at: "",
        updated_at: "",
      },
    ]);
    mockListLabelBadges.mockResolvedValue(
      new Map([
        ["conv-1", [{ id: "lbl-vip", name: "VIP", source: "user" as const }]],
      ]),
    );

    const { buildAgentInstructions } = await import("./skills-catalog.js");
    const prompt = await buildAgentInstructions("ws-1", "agent-1", false, "conv-1");

    expect(mockListLabelBadges).toHaveBeenCalledWith("ws-1", ["conv-1"]);
    expect(prompt).toContain("### Conversation labels");
    expect(prompt).toContain("lbl-vip");
    expect(prompt).toContain('source=user');
    expect(prompt).toContain("previous 10 messages");
  });
});

describe("formatHandoffTopicsInstruction", () => {
  // Selected groups become prompt guidance the agent follows for handoff_to_human.
  it("formats marked handoff groups into Handoff Guidance bullets", async () => {
    const { formatHandoffTopicsInstruction } = await import("./skills-catalog.js");
    const text = formatHandoffTopicsInstruction([
      {
        id: "hg-1",
        name: "Billing",
        entries: [
          { id: "entry-1", topic: "Refunds", description: "Customer wants money back" },
        ],
      },
    ]);
    expect(text).toContain("call `handoff_to_human`");
    expect(text).toContain("topicEntryId");
    expect(text).toContain("#### Billing");
    expect(text).toContain("id=`entry-1`");
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
        id: "hg-1",
        name: "Escalations",
        entries: [
          { id: "entry-legal", topic: "Legal threat", description: "Escalate immediately" },
        ],
      },
    ]);

    const { buildAgentInstructions } = await import("./skills-catalog.js");
    const prompt = await buildAgentInstructions("ws-1", "agent-1");

    expect(mockListHandoff).toHaveBeenCalledWith("ws-1", ["hg-1"]);
    expect(prompt).toContain("### Handoff Guidance");
    expect(prompt).toContain("#### Escalations");
    expect(prompt).toContain("id=`entry-legal`");
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
    expect(prompt).not.toContain("topicEntryId");
  });
});

describe("buildKnowledgeSourceCatalog", () => {
  // Operators match model-declared refs against authored names, including group and entry labels.
  it("collects context, template, skill, and handoff labels", async () => {
    const { buildKnowledgeSourceCatalog } = await import("./skills-catalog.js");
    const catalog = buildKnowledgeSourceCatalog({
      context: [
        {
          id: "ctx-g1",
          name: "Policies",
          entries: [{ id: "ctx-e1", title: "Refund policy", body_text: "90 days" }],
        },
      ],
      templates: [
        {
          id: "tpl-g1",
          name: "Greetings",
          entries: [{ id: "tpl-e1", question_text: "Hi there", answer_text: "Hello" }],
        },
      ],
      handoff: [
        {
          id: "ho-g1",
          name: "Escalations",
          entries: [{ id: "entry-1", topic: "Billing", description: "" }],
        },
      ],
      skills: [{ id: "s1", skillKey: "booking_flow", name: "Booking flow", description: "" }],
    });
    expect(catalog.items).toEqual(
      expect.arrayContaining([
        { kind: "context", label: "Refund policy", id: "ctx-e1", groupId: "ctx-g1" },
        { kind: "context", label: "Policies", id: "ctx-g1", groupId: "ctx-g1" },
        { kind: "template", label: "Hi there", id: "tpl-e1", groupId: "tpl-g1" },
        { kind: "template", label: "Greetings", id: "tpl-g1", groupId: "tpl-g1" },
        { kind: "skill", label: "Booking flow", id: "s1", groupId: null },
        { kind: "skill", label: "booking_flow", id: "s1", groupId: null },
        { kind: "handoff", label: "Billing", id: "entry-1", groupId: "ho-g1" },
        { kind: "handoff", label: "Escalations", id: "ho-g1", groupId: "ho-g1" },
      ]),
    );
    expect(catalog.handoffByEntryId["entry-1"]).toEqual({
      kind: "handoff",
      label: "Billing",
      id: "entry-1",
      groupId: "ho-g1",
    });
  });
});

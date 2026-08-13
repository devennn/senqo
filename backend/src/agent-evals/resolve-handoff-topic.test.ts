import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockListHandoff = vi.fn();

vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: (...args: unknown[]) => mockGetAgent(...args),
}));

vi.mock("../repositories/handoff-topic-groups.js", () => ({
  listHandoffTopicsForInstructions: (...args: unknown[]) => mockListHandoff(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveHandoffTopicFromEvidence", () => {
  // Tool already supplied topicEntryId → keep it, needed so we do not overwrite a real tool call.
  it("keeps topicEntryId from the tool call when present", async () => {
    const { resolveHandoffTopicFromEvidence } = await import("./resolve-handoff-topic.js");
    const result = await resolveHandoffTopicFromEvidence({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      handoffCalled: true,
      topicEntryIdFromTool: "topic-from-tool",
      reasoning: "Billing dispute",
    });
    expect(result).toEqual({
      topicEntryId: "topic-from-tool",
      topicLabel: null,
      source: "tool",
    });
    expect(mockGetAgent).not.toHaveBeenCalled();
  });

  // No tool topic → match expected topic title from reasoning ("billing dispute" ≈ "Billing disputes").
  it("matches expected topic title from reasoning when tool omitted topicEntryId", async () => {
    mockGetAgent.mockResolvedValue({
      id: "agent-1",
      handoff_topic_groups: ["g1"],
    });
    mockListHandoff.mockResolvedValue([
      {
        name: "Escalations",
        entries: [
          {
            id: "topic-billing",
            topic: "Billing disputes",
            description: "Overcharge or refund fights",
          },
        ],
      },
    ]);

    const { resolveHandoffTopicFromEvidence } = await import("./resolve-handoff-topic.js");
    const result = await resolveHandoffTopicFromEvidence({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      handoffCalled: true,
      topicEntryIdFromTool: null,
      reasoning:
        "The customer asked for a refund on an overcharge, classified as a billing dispute under Handoff Guidance.",
      expectedTopicEntryId: "topic-billing",
    });
    expect(result.source).toBe("reasoning");
    expect(result.topicEntryId).toBe("topic-billing");
    expect(result.topicLabel).toBe("Billing disputes");
  });
});

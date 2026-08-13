import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunAgentSession = vi.fn();

vi.mock("../agent/agent.js", () => ({
  runAgentSession: (...args: unknown[]) => mockRunAgentSession(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runSubjectEval", () => {
  // Subject replay with trailing user turn → calls runAgentSession dryRun with historyOverride, needed to prove evals reuse production loop.
  it("invokes runAgentSession with dryRun and historyOverride", async () => {
    mockRunAgentSession.mockResolvedValue({
      sessionId: "sess-1",
      messages: [{ text: "We are open 9–6.", assetFileName: "" }],
      handoff_enabled: false,
      handoffCalled: false,
      handoffTopicEntryId: null,
      handoffReason: null,
      reasoningForOperators:
        "Hours came from workspace context. Answered with the published schedule.",
    });

    const { runSubjectEval } = await import("./subject.js");
    const result = await runSubjectEval({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      turns: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
        { role: "user", content: "What are your hours?" },
      ],
    });

    expect(result?.actualReply).toBe("We are open 9–6.");
    expect(result?.reasoningForOperators).toBe(
      "Hours came from workspace context. Answered with the published schedule.",
    );
    expect(mockRunAgentSession).toHaveBeenCalledTimes(1);
    const arg = mockRunAgentSession.mock.calls[0]?.[0] as {
      dryRun: boolean;
      historyOverride: unknown[];
      message: string;
      agentConfigId: string;
    };
    expect(arg.dryRun).toBe(true);
    expect(arg.agentConfigId).toBe("agent-1");
    expect(arg.historyOverride.length).toBe(2);
    expect(arg.message).toContain("What are your hours?");
  });

  // No user turns → null without calling the agent, needed to avoid empty eval runs.
  it("returns null when there is no inbound user turn", async () => {
    const { runSubjectEval } = await import("./subject.js");
    const result = await runSubjectEval({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      turns: [{ role: "assistant", content: "Hello" }],
    });

    expect(result).toBeNull();
    expect(mockRunAgentSession).not.toHaveBeenCalled();
  });
});

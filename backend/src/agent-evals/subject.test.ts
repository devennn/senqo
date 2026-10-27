import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunAgentSession = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock("../agent/agent.js", () => ({
  runAgentSession: (...args: unknown[]) => mockRunAgentSession(...args),
}));

vi.mock("../lib/storage.js", () => ({
  storageCreateSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
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

  // Eval cases persist storage coordinates; the saved signedUrl expires, so the
  // subject replay must mint a fresh URL from the path instead of downloading it.
  it("signs fresh media URLs from stored paths instead of the persisted signedUrl", async () => {
    mockRunAgentSession.mockResolvedValue({
      sessionId: "sess-1",
      messages: [{ text: "That's a menu.", assetFileName: "" }],
      handoff_enabled: false,
      handoffCalled: false,
      handoffTopicEntryId: null,
      handoffReason: null,
      reasoningForOperators: "Described the attachment.",
    });
    mockCreateSignedUrl.mockResolvedValue("https://storage.example/fresh");

    const { runSubjectEval } = await import("./subject.js");
    const result = await runSubjectEval({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      turns: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
        {
          role: "user",
          content: "What is this?",
          media: {
            path: "ws-1/chat-1/msg-1/photo.bin",
            storageBucket: "whatsapp-media",
            mimeType: "image/jpeg",
            fileName: "photo.bin",
            signedUrl: "https://storage.example/stale?X-Amz-Signature=stale",
          },
        },
      ],
    });

    expect(result?.actualReply).toBe("That's a menu.");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "whatsapp-media",
      "ws-1/chat-1/msg-1/photo.bin",
      3600,
    );
    const arg = mockRunAgentSession.mock.calls[0]?.[0] as {
      userMediaParts: unknown;
    };
    expect(arg.userMediaParts).toEqual([{ url: "https://storage.example/fresh" }]);
    expect(JSON.stringify(arg)).not.toContain("stale");
  });

  // A stored object that cannot be signed must not fail the eval run; the turn
  // is replayed without the attachment.
  it("omits media parts when the stored object cannot be signed", async () => {
    mockRunAgentSession.mockResolvedValue({
      sessionId: "sess-1",
      messages: [{ text: "I can't open that.", assetFileName: "" }],
      handoff_enabled: false,
      handoffCalled: false,
      handoffTopicEntryId: null,
      handoffReason: null,
      reasoningForOperators: "",
    });
    mockCreateSignedUrl.mockResolvedValue(null);

    const { runSubjectEval } = await import("./subject.js");
    await runSubjectEval({
      workspaceId: "ws-1",
      agentConfigId: "agent-1",
      turns: [
        {
          role: "user",
          content: "",
          media: {
            path: "ws-1/chat-1/msg-1/photo.bin",
            storageBucket: "whatsapp-media",
            mimeType: "image/jpeg",
            fileName: "photo.bin",
          },
        },
      ],
    });

    const arg = mockRunAgentSession.mock.calls[0]?.[0] as {
      userMediaParts: unknown;
    };
    expect(arg.userMediaParts).toBeUndefined();
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

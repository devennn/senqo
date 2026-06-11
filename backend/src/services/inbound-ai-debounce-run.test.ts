import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunAgentSession = vi.fn();
const mockGetConversationHandlingMode = vi.fn();
const mockListConversationMessagesBareForAi = vi.fn();
const mockGetContactIsTestForConversation = vi.fn();
const mockGetWhatsappConnectionModeForInboundAi = vi.fn();
const mockClearInboundAiDebouncePending = vi.fn();

vi.mock("../agent/agent.js", () => ({
  runAgentSession: mockRunAgentSession,
}));

vi.mock("../repositories/conversations.js", () => ({
  getConversationHandlingMode: mockGetConversationHandlingMode,
  listConversationMessagesBareForAi: mockListConversationMessagesBareForAi,
  updateConversationHandlingMode: vi.fn(),
}));

vi.mock("../repositories/contacts.js", () => ({
  getContactIsTestForConversation: mockGetContactIsTestForConversation,
}));

vi.mock("../repositories/inbound-ai-debounce-pending.js", () => ({
  clearInboundAiDebouncePending: mockClearInboundAiDebouncePending,
}));

vi.mock("../repositories/whatsapp.js", () => ({
  createConversationMessage: vi.fn(),
  getWhatsappConnectionModeForInboundAi: mockGetWhatsappConnectionModeForInboundAi,
}));

vi.mock("../lib/inbound-media-resolve.js", () => ({
  resolveInboundMediaSigned: vi.fn(),
}));

const { executeInboundDebouncedAiRun } = await import("./inbound-ai-debounce-run.js");

const baseInput = {
  workspaceId: "ws-1",
  conversationId: "conv-1",
  agentConfigId: "agent-1",
  whatsappConnectionId: "conn-testing",
};

function mockTrailingUserMessage(content = "hello") {
  mockListConversationMessagesBareForAi.mockResolvedValue([
    {
      role: "user",
      content,
      created_at: "2026-06-11T10:00:00.000Z",
    },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConversationHandlingMode.mockResolvedValue("ai");
  mockGetContactIsTestForConversation.mockResolvedValue(true);
  mockRunAgentSession.mockResolvedValue({
    sessionId: "conv-1",
    reply: "Hi there",
    num_whatsapp_send: 0,
    modelMessages: [],
    reasoningForOperators: "",
  });
  mockClearInboundAiDebouncePending.mockResolvedValue(true);
});

describe("executeInboundDebouncedAiRun", () => {
  // Debounce job carries the testing line that received the inbound → mode lookup uses that line and AI inference runs, needed to verify the multi-connection fix end-to-end in the debounced path.
  it("runs AI when the debounce job scopes to a testing line and test contact", async () => {
    mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("testing");
    mockTrailingUserMessage();

    const result = await executeInboundDebouncedAiRun(baseInput);

    expect(result.ok).toBe(true);
    expect(mockGetWhatsappConnectionModeForInboundAi).toHaveBeenCalledWith(
      "ws-1",
      "conv-1",
      "agent-1",
      "conn-testing",
    );
    expect(mockRunAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        skipInference: false,
        skipInferenceReason: undefined,
      }),
    );
  });

  // Resolved mode is inactive (stale thread line) → inbound is saved but inference is skipped with the inactive reason, matching the operator-visible failure mode.
  it("skips inference when resolved connection mode is inactive", async () => {
    mockGetWhatsappConnectionModeForInboundAi.mockResolvedValue("inactive");
    mockTrailingUserMessage();

    const result = await executeInboundDebouncedAiRun({
      ...baseInput,
      whatsappConnectionId: undefined,
    });

    expect(result.ok).toBe(true);
    expect(mockRunAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        skipInference: true,
        skipInferenceReason: "connection mode is inactive",
      }),
    );
  });
});

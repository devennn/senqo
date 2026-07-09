import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOnConflictDoNothing = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

vi.mock("../db/index.js", () => ({
  db: { insert: mockInsert },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReturnValue({ values: mockValues });
});

describe("insertAgentMessages", () => {
  // Mirror insert with whatsappMessageId in providerOptions → row includes waMessageId and uses onConflictDoNothing, needed so duplicate outbound mirrors do not double-write agent transcript.
  it("writes waMessageId and ignores duplicates when ignoreDuplicates is true", async () => {
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });

    const { insertAgentMessages } = await import("../repositories/agent-messages.js");
    const ok = await insertAgentMessages(
      [
        {
          workspaceId: "ws-1",
          sessionId: "conv-1",
          role: "assistant",
          content: "hello",
          providerOptions: { whatsappMessageId: "wa-1" },
        },
      ],
      { ignoreDuplicates: true },
    );

    expect(ok).toBe(true);
    expect(mockValues).toHaveBeenCalledWith([
      expect.objectContaining({
        workspaceId: "ws-1",
        agentSessionId: "conv-1",
        waMessageId: "wa-1",
      }),
    ]);
    expect(mockOnConflictDoNothing).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
      }),
    );
  });

  // Explicit waMessageId on input wins over providerOptions, needed when callers pass the Baileys id separately.
  it("prefers explicit waMessageId over providerOptions", async () => {
    mockValues.mockResolvedValue(undefined);

    const { insertAgentMessages } = await import("../repositories/agent-messages.js");
    const ok = await insertAgentMessages([
      {
        workspaceId: "ws-1",
        sessionId: "conv-1",
        role: "assistant",
        content: "hello",
        providerOptions: { whatsappMessageId: "from-options" },
        waMessageId: "from-input",
      },
    ]);

    expect(ok).toBe(true);
    expect(mockValues).toHaveBeenCalledWith([
      expect.objectContaining({ waMessageId: "from-input" }),
    ]);
    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
  });

  // Insert throws → false, needed so conversation-persist can report mirror failure.
  it("returns false when insert throws", async () => {
    mockValues.mockRejectedValue(new Error("db error"));

    const { insertAgentMessages } = await import("../repositories/agent-messages.js");
    const ok = await insertAgentMessages([
      {
        workspaceId: "ws-1",
        sessionId: "conv-1",
        role: "user",
        content: "hi",
      },
    ]);

    expect(ok).toBe(false);
  });
});

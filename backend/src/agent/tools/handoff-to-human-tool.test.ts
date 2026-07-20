import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateMode = vi.fn();
const mockCreateMessage = vi.fn();
const mockScheduleNotify = vi.fn();

vi.mock("../../repositories/conversations.js", () => ({
  updateConversationHandlingMode: (...args: unknown[]) => mockUpdateMode(...args),
}));

vi.mock("../../repositories/whatsapp.js", () => ({
  createConversationMessage: (...args: unknown[]) => mockCreateMessage(...args),
}));

vi.mock("../../services/handoff-notify.js", () => ({
  scheduleHandoffNotify: (...args: unknown[]) => mockScheduleNotify(...args),
}));

describe("createHandoffToHumanTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMode.mockResolvedValue({ ok: true });
    mockCreateMessage.mockResolvedValue({ ok: true });
  });

  // Mode flips to human and returns ok even when notify is a no-op / would fail later.
  // Ensures WhatsApp alert delivery never blocks the handling-mode toggle.
  it("switches to human mode and returns ok when notify is scheduled", async () => {
    const { createHandoffToHumanTool } = await import("./handoff-to-human-tool.js");
    const handoffTool = createHandoffToHumanTool({
      workspaceId: "ws-1",
      sessionId: "conv-1",
      agentConfigId: "agent-1",
    });

    const result = await handoffTool.execute!(
      { reason: "Billing dispute" },
      { toolCallId: "tc-1", messages: [] },
    );

    expect(mockUpdateMode).toHaveBeenCalledWith("ws-1", "conv-1", "human");
    expect(mockScheduleNotify).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      reason: "Billing dispute",
    });
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
      }),
    );
  });

  // Mode update succeeds even when the thread-event persist fails; notify still scheduled.
  it("returns ok and schedules notify when thread event save fails", async () => {
    mockUpdateMode.mockResolvedValue({ ok: true });
    mockCreateMessage.mockResolvedValue({ ok: false });
    const { createHandoffToHumanTool } = await import("./handoff-to-human-tool.js");
    const handoffTool = createHandoffToHumanTool({
      workspaceId: "ws-1",
      sessionId: "conv-1",
      agentConfigId: "agent-1",
    });

    const result = await handoffTool.execute!(
      { reason: "Escalation" },
      { toolCallId: "tc-3", messages: [] },
    );

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(mockScheduleNotify).toHaveBeenCalled();
  });

  // Mode update failure is the only hard failure — notify is not even attempted.
  it("returns ok false when handling mode update fails", async () => {
    mockUpdateMode.mockResolvedValue({ ok: false });
    const { createHandoffToHumanTool } = await import("./handoff-to-human-tool.js");
    const handoffTool = createHandoffToHumanTool({
      workspaceId: "ws-1",
      sessionId: "conv-1",
    });

    const result = await handoffTool.execute!(
      { reason: "Need human" },
      { toolCallId: "tc-2", messages: [] },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
      }),
    );
    expect(mockScheduleNotify).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi } from "vitest";

vi.mock("../repositories/agent-sessions.js", () => ({
  createAgentConversation: vi.fn(),
  createAgentSession: vi.fn(),
  findAgentSession: vi.fn(),
}));

import {
  createAgentConversation,
  createAgentSession,
  findAgentSession,
} from "../repositories/agent-sessions.js";
import { resolveSessionId } from "./session.js";

const createAgentConversationMock = vi.mocked(createAgentConversation);
const createAgentSessionMock = vi.mocked(createAgentSession);
const findAgentSessionMock = vi.mocked(findAgentSession);

beforeEach(() => {
  createAgentConversationMock.mockReset();
  createAgentSessionMock.mockReset();
  findAgentSessionMock.mockReset();
});

describe("resolveSessionId", () => {
  it("creates new session when none exists", async () => {
    createAgentConversationMock.mockResolvedValue("conv-1");
    createAgentSessionMock.mockResolvedValue({ id: "sess-1" } as never);

    const result = await resolveSessionId("ws-1", false);

    expect(result).toBe("sess-1");
    expect(createAgentConversationMock).toHaveBeenCalledWith(
      "ws-1",
      "AI Agent Session",
    );
    expect(createAgentSessionMock).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      sessionId: "conv-1",
      metadata: { source: "agent-runtime" },
    });
  });

  it("reuses existing session when sessionId provided and found", async () => {
    findAgentSessionMock.mockResolvedValue({ id: "existing-sess" } as never);

    const result = await resolveSessionId("ws-1", false, "existing-sess");

    expect(result).toBe("existing-sess");
    expect(findAgentSessionMock).toHaveBeenCalledWith("ws-1", "existing-sess");
    expect(createAgentConversationMock).not.toHaveBeenCalled();
  });

  it("skips DB writes in dry-run mode", async () => {
    const result = await resolveSessionId("ws-1", true);

    expect(result).toEqual(expect.any(String));
    expect(result).toHaveLength(36); // UUID format
    expect(createAgentConversationMock).not.toHaveBeenCalled();
    expect(createAgentSessionMock).not.toHaveBeenCalled();
    expect(findAgentSessionMock).not.toHaveBeenCalled();
  });

  it("returns null when createAgentConversation fails", async () => {
    createAgentConversationMock.mockResolvedValue(null);

    const result = await resolveSessionId("ws-1", false);

    expect(result).toBeNull();
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });
});

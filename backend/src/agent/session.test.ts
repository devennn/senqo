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
  // Creates a new conversation then a new session when no sessionId is provided.
  // Expected: returns the new session ID and calls both creation repos.
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

  // Skips creating new resources when an existing sessionId is found in the DB.
  // Expected: returns the existing session ID; no conversation/session creation.
  it("reuses existing session when sessionId provided and found", async () => {
    findAgentSessionMock.mockResolvedValue({ id: "existing-sess" } as never);

    const result = await resolveSessionId("ws-1", false, "existing-sess");

    expect(result).toBe("existing-sess");
    expect(findAgentSessionMock).toHaveBeenCalledWith("ws-1", "existing-sess");
    expect(createAgentConversationMock).not.toHaveBeenCalled();
  });

  // In dry-run mode no DB writes should happen; a synthetic UUID is returned.
  // Expected: result is a 36-char UUID string, no repo calls made.
  it("skips DB writes in dry-run mode", async () => {
    const result = await resolveSessionId("ws-1", true);

    expect(result).toEqual(expect.any(String));
    expect(result).toHaveLength(36); // UUID format
    expect(createAgentConversationMock).not.toHaveBeenCalled();
    expect(createAgentSessionMock).not.toHaveBeenCalled();
    expect(findAgentSessionMock).not.toHaveBeenCalled();
  });

  // If conversation creation fails (returns null), the whole flow should abort.
  // Expected: returns null and does not attempt to create a session.
  it("returns null when createAgentConversation fails", async () => {
    createAgentConversationMock.mockResolvedValue(null);

    const result = await resolveSessionId("ws-1", false);

    expect(result).toBeNull();
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });
});

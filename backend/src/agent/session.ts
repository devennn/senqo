import {
  createAgentConversation,
  createAgentSession,
  findAgentSession,
} from "../repositories/agent-sessions.js";

export async function resolveSessionId(
  workspaceId: string,
  dryRun: boolean,
  sessionId?: string,
): Promise<string | null> {
  if (dryRun) {
    return sessionId ?? crypto.randomUUID();
  }

  if (sessionId) {
    const session = await findAgentSession(workspaceId, sessionId);
    if (session?.id) {
      return session.id;
    }

    const created = await createAgentSession({
      workspaceId,
      sessionId,
      metadata: { source: "agent-runtime-bootstrap" },
    });
    return created?.id ?? null;
  }

  const conversationId = await createAgentConversation(
    workspaceId,
    "AI Agent Session",
  );
  if (!conversationId) {
    return null;
  }

  const created = await createAgentSession({
    workspaceId,
    sessionId: conversationId,
    metadata: { source: "agent-runtime" },
  });
  return created?.id ?? null;
}

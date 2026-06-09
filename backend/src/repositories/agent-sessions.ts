import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentSessions,
  conversations,
} from "../db/schema/index.js";
import type {
  AgentSessionRecord,
  CreateAgentSessionInput,
} from "../types/repositories.js";

const scope = "AgentSessionsRepository";

export async function findAgentSession(
  workspaceId: string,
  sessionId: string
): Promise<AgentSessionRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.workspaceId, workspaceId),
          eq(agentSessions.id, sessionId),
        ),
      );

    if (!row) {
      console.info(`[${scope}/findAgentSession] Success: workspaceId=${workspaceId} found=false`);
      return null;
    }

    console.info(`[${scope}/findAgentSession] Success: workspaceId=${workspaceId}`);
    return row as unknown as AgentSessionRecord;
  } catch (error) {
    console.error(`[${scope}/findAgentSession] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createAgentConversation(workspaceId: string, title: string): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    await db.insert(conversations).values({
      id,
      workspaceId,
      title,
      status: "open",
    });

    console.info(`[${scope}/createAgentConversation] Success: workspaceId=${workspaceId}`);
    return id;
  } catch (error) {
    console.error(`[${scope}/createAgentConversation] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createAgentSession(
  input: CreateAgentSessionInput
): Promise<AgentSessionRecord | null> {
  try {
    const [row] = await db
      .insert(agentSessions)
      .values({
        id: input.sessionId,
        workspaceId: input.workspaceId,
        status: "active",
        metadata: input.metadata ?? {},
      })
      .returning();

    console.info(`[${scope}/createAgentSession] Success: workspaceId=${input.workspaceId}`);
    return row as unknown as AgentSessionRecord;
  } catch (error) {
    console.error(`[${scope}/createAgentSession] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function touchAgentSession(workspaceId: string, sessionId: string): Promise<boolean> {
  try {
    await db
      .update(agentSessions)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(agentSessions.workspaceId, workspaceId),
          eq(agentSessions.id, sessionId),
        ),
      );

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, sessionId),
        ),
      );

    console.info(`[${scope}/touchAgentSession] Success: workspaceId=${workspaceId}`);
    return true;
  } catch (error) {
    console.error(`[${scope}/touchAgentSession] Unexpected error: ${String(error)}`);
    return false;
  }
}
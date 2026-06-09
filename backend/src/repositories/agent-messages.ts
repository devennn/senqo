import { eq, asc, and } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentMessages,
} from "../db/schema/index.js";
import type {
  AgentMessageRecord,
  InsertAgentMessageInput,
} from "../types/repositories.js";

const scope = "AgentMessagesRepository";

export async function listAgentMessages(
  workspaceId: string,
  sessionId: string
): Promise<AgentMessageRecord[]> {
  try {
    const rows = await db
      .select()
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.workspaceId, workspaceId),
          eq(agentMessages.agentSessionId, sessionId),
        ),
      )
      .orderBy(asc(agentMessages.createdAt));

    console.info(
      `[${scope}/listAgentMessages] Success: workspaceId=${workspaceId} sessionId=${sessionId}`
    );
    return rows as unknown as AgentMessageRecord[];
  } catch (error) {
    console.error(`[${scope}/listAgentMessages] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function insertAgentMessages(
  input: InsertAgentMessageInput[],
  options?: { ignoreDuplicates?: boolean }
): Promise<boolean> {
  if (input.length === 0) return true;

  const workspaceId = input[0].workspaceId;
  const sessionId = input[0].sessionId;

  try {
    const rows = input.map((item) => ({
      workspaceId: item.workspaceId,
      agentSessionId: item.sessionId,
      role: item.role,
      content: item.content as never,
      providerOptions: item.providerOptions ?? null,
    }));

    if (options?.ignoreDuplicates) {
      await db.insert(agentMessages).values(rows).onConflictDoNothing();
    } else {
      await db.insert(agentMessages).values(rows);
    }

    console.info(
      `[${scope}/insertAgentMessages] Success: workspaceId=${workspaceId} sessionId=${sessionId} count=${input.length}`
    );
    return true;
  } catch (error) {
    console.error(`[${scope}/insertAgentMessages] Unexpected error: ${String(error)}`);
    return false;
  }
}
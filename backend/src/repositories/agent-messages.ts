import { eq, asc, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentMessages,
} from "../db/schema/index.js";
import type {
  AgentMessageRecord,
  InsertAgentMessageInput,
} from "../types/repositories.js";

const scope = "AgentMessagesRepository";

function resolveAgentWaMessageId(item: InsertAgentMessageInput): string | null {
  const fromInput =
    typeof item.waMessageId === "string" ? item.waMessageId.trim() : "";
  if (fromInput) return fromInput;
  const fromOptions = item.providerOptions?.whatsappMessageId;
  if (typeof fromOptions === "string" && fromOptions.trim()) return fromOptions.trim();
  return null;
}

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
    return rows.map((row) => ({
      id: row.id,
      workspace_id: row.workspaceId,
      agent_session_id: row.agentSessionId,
      role: row.role as AgentMessageRecord["role"],
      content: row.content,
      provider_options: (row.providerOptions as Record<string, unknown> | null) ?? null,
      created_at:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
    }));
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
      waMessageId: resolveAgentWaMessageId(item),
    }));

    if (options?.ignoreDuplicates) {
      await db
        .insert(agentMessages)
        .values(rows)
        .onConflictDoNothing({
          target: [agentMessages.workspaceId, agentMessages.waMessageId],
          where: sql`${agentMessages.waMessageId} is not null`,
        });
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

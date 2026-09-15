import { eq, asc, and, desc, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentMessages,
} from "../db/schema/index.js";
import type {
  AgentMessageRecord,
  InsertAgentMessageInput,
} from "../types/repositories.js";

const scope = "AgentMessagesRepository";

const DEFAULT_AGENT_MESSAGES_PAGE_SIZE = 100;
const MAX_AGENT_MESSAGES_PAGE_SIZE = 200;

export type ListAgentMessagesPageResult = {
  messages: AgentMessageRecord[];
  hasMoreOlderMessages: boolean;
};

function clampAgentMessagesPageSize(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 1) {
    return DEFAULT_AGENT_MESSAGES_PAGE_SIZE;
  }
  return Math.min(Math.floor(requested), MAX_AGENT_MESSAGES_PAGE_SIZE);
}

function toAgentMessageRecord(row: typeof agentMessages.$inferSelect): AgentMessageRecord {
  return {
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
  };
}

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
    return rows.map(toAgentMessageRecord);
  } catch (error) {
    console.error(`[${scope}/listAgentMessages] Unexpected error: ${String(error)}`);
    return [];
  }
}

/**
 * Paged agent transcript for the owner logs dialog. Returns the newest page
 * (ascending) plus a flag for loading older pages via the before* cursor.
 */
export async function listAgentMessagesPage(
  workspaceId: string,
  sessionId: string,
  options?: { limit?: number; beforeCreatedAt?: string; beforeId?: string }
): Promise<ListAgentMessagesPageResult> {
  const capped = clampAgentMessagesPageSize(options?.limit);
  const fetchSize = capped + 1;
  const beforeCreatedAt = options?.beforeCreatedAt?.trim() ?? "";
  const beforeId = options?.beforeId?.trim() ?? "";
  const beforeDate =
    beforeCreatedAt.length > 0 && beforeId.length > 0 ? new Date(beforeCreatedAt) : null;
  const cursor =
    beforeDate && !Number.isNaN(beforeDate.getTime())
      ? or(
          lt(agentMessages.createdAt, beforeDate),
          and(
            eq(agentMessages.createdAt, beforeDate),
            lt(agentMessages.id, beforeId),
          ),
        )
      : undefined;

  try {
    const rawRows = await db
      .select()
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.workspaceId, workspaceId),
          eq(agentMessages.agentSessionId, sessionId),
          cursor,
        ),
      )
      .orderBy(desc(agentMessages.createdAt), desc(agentMessages.id))
      .limit(fetchSize);

    const hasMoreOlderMessages = rawRows.length > capped;
    const pageRows = hasMoreOlderMessages ? rawRows.slice(0, capped) : rawRows;
    const messages = [...pageRows].reverse().map(toAgentMessageRecord);
    console.info(
      `[${scope}/listAgentMessagesPage] Success: workspaceId=${workspaceId} sessionId=${sessionId} count=${messages.length}`
    );
    return { messages, hasMoreOlderMessages };
  } catch (error) {
    console.error(`[${scope}/listAgentMessagesPage] Unexpected error: ${String(error)}`);
    return { messages: [], hasMoreOlderMessages: false };
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

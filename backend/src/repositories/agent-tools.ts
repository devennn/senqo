import { eq, and, isNull, desc, asc, inArray, not } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentToolDefinitions,
} from "../db/schema/index.js";
import type { AgentToolDefinitionRecord } from "../types/repositories.js";

const scope = "AgentToolsRepository";

export async function listActiveAgentToolDefinitions(
  workspaceId: string,
): Promise<AgentToolDefinitionRecord[]> {
  try {
    const rows = await db
      .select()
      .from(agentToolDefinitions)
      .where(
        and(
          eq(agentToolDefinitions.isActive, true),
          not(eq(agentToolDefinitions.scope, "workspace")),
        ),
      )
      .orderBy(asc(agentToolDefinitions.displayName));

    const workspaceTools = await db
      .select()
      .from(agentToolDefinitions)
      .where(
        and(
          eq(agentToolDefinitions.isActive, true),
          eq(agentToolDefinitions.scope, "workspace"),
          eq(agentToolDefinitions.workspaceId, workspaceId),
        ),
      )
      .orderBy(asc(agentToolDefinitions.displayName));

    const allTools = [...rows, ...workspaceTools];
    console.info(`[${scope}/listActiveAgentToolDefinitions] Success: workspaceId=${workspaceId}`);
    return allTools as unknown as AgentToolDefinitionRecord[];
  } catch (error) {
    console.error(`[${scope}/listActiveAgentToolDefinitions] Unexpected error: ${String(error)}`);
    return [];
  }
}
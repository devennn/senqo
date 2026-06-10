import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { agentConfigs, workspaceCustomTools } from "../db/schema/index.js";
import { isBuiltinAgentToolKey } from "../lib/builtin-agent-tool-keys.js";
import { compileCustomToolSource } from "../services/custom-tool-compile.js";
import type {
  WorkspaceCustomToolDetailRecord,
  WorkspaceCustomToolListItem,
} from "../types/repositories.js";

const scope = "WorkspaceCustomToolsRepository";

function normalizeToolKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toListItem(row: typeof workspaceCustomTools.$inferSelect): WorkspaceCustomToolListItem {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    tool_key: row.toolKey,
    display_name: row.displayName,
    description: row.description,
    required_env: Array.isArray(row.requiredEnv) ? (row.requiredEnv as string[]) : [],
    is_active: row.isActive,
    source_hash: row.sourceHash,
    created_at:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function toDetail(row: typeof workspaceCustomTools.$inferSelect): WorkspaceCustomToolDetailRecord {
  return {
    ...toListItem(row),
    source_code: row.sourceCode,
    input_schema:
      row.inputSchema && typeof row.inputSchema === "object"
        ? (row.inputSchema as Record<string, unknown>)
        : {},
    test_input: row.testInput ?? "",
  };
}

export async function listWorkspaceCustomTools(
  workspaceId: string,
): Promise<WorkspaceCustomToolListItem[]> {
  try {
    const rows = await db
      .select()
      .from(workspaceCustomTools)
      .where(eq(workspaceCustomTools.workspaceId, workspaceId))
      .orderBy(asc(workspaceCustomTools.displayName));
    console.info(`[${scope}/listWorkspaceCustomTools] Success: workspaceId=${workspaceId}`);
    return rows.map(toListItem);
  } catch (error) {
    console.error(`[${scope}/listWorkspaceCustomTools] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function listActiveWorkspaceCustomTools(
  workspaceId: string,
): Promise<WorkspaceCustomToolListItem[]> {
  try {
    const rows = await db
      .select()
      .from(workspaceCustomTools)
      .where(
        and(
          eq(workspaceCustomTools.workspaceId, workspaceId),
          eq(workspaceCustomTools.isActive, true),
        ),
      )
      .orderBy(asc(workspaceCustomTools.displayName));
    console.info(`[${scope}/listActiveWorkspaceCustomTools] Success: workspaceId=${workspaceId}`);
    return rows.map(toListItem);
  } catch (error) {
    console.error(`[${scope}/listActiveWorkspaceCustomTools] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getWorkspaceCustomToolById(
  workspaceId: string,
  toolId: string,
): Promise<WorkspaceCustomToolDetailRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(workspaceCustomTools)
      .where(
        and(
          eq(workspaceCustomTools.workspaceId, workspaceId),
          eq(workspaceCustomTools.id, toolId),
        ),
      );
    if (!row) {
      console.info(`[${scope}/getWorkspaceCustomToolById] Success: not found workspaceId=${workspaceId}`);
      return null;
    }
    console.info(`[${scope}/getWorkspaceCustomToolById] Success: workspaceId=${workspaceId}`);
    return toDetail(row);
  } catch (error) {
    console.error(`[${scope}/getWorkspaceCustomToolById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function getWorkspaceCustomToolByKey(
  workspaceId: string,
  toolKey: string,
): Promise<WorkspaceCustomToolDetailRecord | null> {
  try {
    const [row] = await db
      .select()
      .from(workspaceCustomTools)
      .where(
        and(
          eq(workspaceCustomTools.workspaceId, workspaceId),
          eq(workspaceCustomTools.toolKey, toolKey),
        ),
      );
    if (!row) return null;
    console.info(`[${scope}/getWorkspaceCustomToolByKey] Success: workspaceId=${workspaceId}`);
    return toDetail(row);
  } catch (error) {
    console.error(`[${scope}/getWorkspaceCustomToolByKey] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function listWorkspaceCustomToolsByKeys(
  workspaceId: string,
  toolKeys: string[],
): Promise<WorkspaceCustomToolDetailRecord[]> {
  if (toolKeys.length === 0) return [];
  try {
    const rows = await db
      .select()
      .from(workspaceCustomTools)
      .where(
        and(
          eq(workspaceCustomTools.workspaceId, workspaceId),
          inArray(workspaceCustomTools.toolKey, toolKeys),
          eq(workspaceCustomTools.isActive, true),
        ),
      );
    console.info(`[${scope}/listWorkspaceCustomToolsByKeys] Success: workspaceId=${workspaceId}`);
    return rows.map(toDetail);
  } catch (error) {
    console.error(`[${scope}/listWorkspaceCustomToolsByKeys] Unexpected error: ${String(error)}`);
    return [];
  }
}

async function stripCustomToolKeyFromAgents(
  workspaceId: string,
  toolKey: string,
): Promise<void> {
  const { listAgentConfigs } = await import("./agent.js");
  const agents = await listAgentConfigs(workspaceId);
  for (const agent of agents) {
    const current = Array.isArray(agent.tools) ? agent.tools.map(String) : [];
    if (!current.includes(toolKey)) continue;
    const next = current.filter((key) => key !== toolKey);
    try {
      await db
        .update(agentConfigs)
        .set({ tools: next })
        .where(
          and(
            eq(agentConfigs.id, agent.id),
            eq(agentConfigs.workspaceId, workspaceId),
            isNull(agentConfigs.archivedAt),
          ),
        );
    } catch (error) {
      console.error(`[${scope}/stripCustomToolKeyFromAgents] Failed query: ${String(error)}`);
    }
  }
  console.info(`[${scope}/stripCustomToolKeyFromAgents] Success: workspaceId=${workspaceId}`);
}

export async function upsertWorkspaceCustomTool(input: {
  workspaceId: string;
  toolId?: string;
  displayName: string;
  description: string;
  sourceCode: string;
  requiredEnv?: string[];
  testInput?: string;
  isActive?: boolean;
  skipSecretCheck?: boolean;
}): Promise<{ ok: boolean; message: string; toolId: string | null }> {
  const toolKey = normalizeToolKey(input.displayName);
  if (!toolKey) {
    console.error(`[${scope}/upsertWorkspaceCustomTool] Failed query: invalid tool key`);
    return { ok: false, message: "Invalid tool name", toolId: null };
  }
  if (isBuiltinAgentToolKey(toolKey)) {
    console.error(`[${scope}/upsertWorkspaceCustomTool] Failed query: reserved tool key`);
    return { ok: false, message: "Tool key reserved for platform tools", toolId: null };
  }

  const compiled = await compileCustomToolSource(input.sourceCode, {
    requiredEnv: input.requiredEnv,
  });
  if (!compiled.ok) {
    console.error(`[${scope}/upsertWorkspaceCustomTool] Failed query: ${compiled.error}`);
    return { ok: false, message: compiled.error, toolId: null };
  }

  if (!input.skipSecretCheck && compiled.metadata.requiredEnv.length > 0) {
    const { listWorkspaceSecretNames } = await import("./workspace-secrets.js");
    const names = await listWorkspaceSecretNames(input.workspaceId);
    const missing = compiled.metadata.requiredEnv.filter((name) => !names.has(name));
    if (missing.length > 0) {
      console.error(`[${scope}/upsertWorkspaceCustomTool] Failed query: missing secrets`);
      return {
        ok: false,
        message: `Missing workspace secrets: ${missing.join(", ")}`,
        toolId: null,
      };
    }
  }

  try {
    if (input.toolId) {
      const current = await getWorkspaceCustomToolById(input.workspaceId, input.toolId);
      if (!current) {
        return { ok: false, message: "Tool not found", toolId: null };
      }
      await db
        .update(workspaceCustomTools)
        .set({
          toolKey,
          displayName: input.displayName.trim(),
          description: input.description.trim(),
          sourceCode: compiled.metadata.normalizedSource,
          requiredEnv: compiled.metadata.requiredEnv,
          inputSchema: compiled.metadata.inputSchema,
          sourceHash: compiled.metadata.sourceHash,
          testInput: input.testInput ?? current.test_input,
          isActive: input.isActive ?? current.is_active,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workspaceCustomTools.workspaceId, input.workspaceId),
            eq(workspaceCustomTools.id, input.toolId),
          ),
        );
      console.info(`[${scope}/upsertWorkspaceCustomTool] Success: updated workspaceId=${input.workspaceId}`);
      return { ok: true, message: "Tool updated", toolId: input.toolId };
    }

    const [inserted] = await db
      .insert(workspaceCustomTools)
      .values({
        workspaceId: input.workspaceId,
        toolKey,
        displayName: input.displayName.trim(),
        description: input.description.trim(),
        sourceCode: compiled.metadata.normalizedSource,
        requiredEnv: compiled.metadata.requiredEnv,
        inputSchema: compiled.metadata.inputSchema,
        sourceHash: compiled.metadata.sourceHash,
        isActive: input.isActive ?? true,
      })
      .returning({ id: workspaceCustomTools.id });
    console.info(`[${scope}/upsertWorkspaceCustomTool] Success: created workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Tool created", toolId: inserted.id };
  } catch (error) {
    if (String(error).includes("workspace_custom_tools_workspace_id_tool_key_unique")) {
      console.error(`[${scope}/upsertWorkspaceCustomTool] Failed query: duplicate tool key`);
      return { ok: false, message: "Tool key already exists", toolId: null };
    }
    console.error(`[${scope}/upsertWorkspaceCustomTool] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error", toolId: null };
  }
}

export async function deleteWorkspaceCustomTool(input: {
  workspaceId: string;
  toolId: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const current = await getWorkspaceCustomToolById(input.workspaceId, input.toolId);
    if (!current) {
      return { ok: false, message: "Tool not found" };
    }
    await db
      .delete(workspaceCustomTools)
      .where(
        and(
          eq(workspaceCustomTools.workspaceId, input.workspaceId),
          eq(workspaceCustomTools.id, input.toolId),
        ),
      );
    await stripCustomToolKeyFromAgents(input.workspaceId, current.tool_key);
    console.info(`[${scope}/deleteWorkspaceCustomTool] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Tool deleted" };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceCustomTool] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function validateCustomToolKeysForWorkspace(
  workspaceId: string,
  toolKeys: string[],
): Promise<{ ok: boolean; message: string; normalized: string[] }> {
  const unique = [...new Set(toolKeys.map((key) => key.trim()).filter(Boolean))];
  const reserved = unique.filter((key) => isBuiltinAgentToolKey(key));
  if (reserved.length > 0) {
    return {
      ok: false,
      message: `Reserved platform tool keys: ${reserved.join(", ")}`,
      normalized: [],
    };
  }
  if (unique.length === 0) {
    return { ok: true, message: "ok", normalized: [] };
  }
  try {
    const rows = await db
      .select({ toolKey: workspaceCustomTools.toolKey })
      .from(workspaceCustomTools)
      .where(
        and(
          eq(workspaceCustomTools.workspaceId, workspaceId),
          inArray(workspaceCustomTools.toolKey, unique),
          eq(workspaceCustomTools.isActive, true),
        ),
      );
    const found = new Set(rows.map((row) => row.toolKey));
    const missing = unique.filter((key) => !found.has(key));
    if (missing.length > 0) {
      console.error(`[${scope}/validateCustomToolKeysForWorkspace] Failed query: missing keys`);
      return { ok: false, message: `Unknown custom tools: ${missing.join(", ")}`, normalized: [] };
    }
    console.info(`[${scope}/validateCustomToolKeysForWorkspace] Success: workspaceId=${workspaceId}`);
    return { ok: true, message: "ok", normalized: unique };
  } catch (error) {
    console.error(`[${scope}/validateCustomToolKeysForWorkspace] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error", normalized: [] };
  }
}

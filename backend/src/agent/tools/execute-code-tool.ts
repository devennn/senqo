import { tool } from "ai";
import { z } from "zod";
import { getAgentConfigById } from "../../repositories/agent.js";
import { listWorkspaceDocAssetsForGroups } from "../../repositories/workspace-asset-groups.js";
import { getWorkspaceAppConnection } from "../../repositories/workspace-app-connections.js";
import { listWorkspaceCustomToolsByKeys } from "../../repositories/workspace-custom-tools.js";
import { resolveCustomToolEnv } from "../../services/custom-tool-env.js";
import { GOOGLEDRIVE_TOOLKIT } from "../../services/composio.js";
import {
  runExecuteCode,
  type ExecuteCodeToolDefinition,
} from "../../services/tool-sandbox/execute-code.js";
import type { AgentToolRuntimeContext } from "./shared.js";

async function loadAttachedCodeTools(
  context: AgentToolRuntimeContext,
  customToolKeys: string[],
): Promise<ExecuteCodeToolDefinition[]> {
  if (customToolKeys.length === 0) {
    return [];
  }
  const definitions = await listWorkspaceCustomToolsByKeys(
    context.workspaceId,
    customToolKeys,
  );
  const tools: ExecuteCodeToolDefinition[] = [];
  for (const definition of definitions) {
    const env = await resolveCustomToolEnv(
      context.workspaceId,
      definition.required_env,
    );
    tools.push({
      toolKey: definition.tool_key,
      source: definition.source_code,
      sourceHash: definition.source_hash,
      env,
    });
  }
  return tools;
}

async function loadComposioContext(context: AgentToolRuntimeContext) {
  const connection = await getWorkspaceAppConnection(
    context.workspaceId,
    GOOGLEDRIVE_TOOLKIT,
  );
  let allowedDocIds: string[] = [];
  if (context.agentConfigId) {
    const agent = await getAgentConfigById(
      context.workspaceId,
      context.agentConfigId,
    );
    const docs = await listWorkspaceDocAssetsForGroups(
      context.workspaceId,
      agent?.asset_groups ?? [],
    );
    allowedDocIds = docs.map((doc) => doc.id);
  }
  if (!connection || connection.status !== "active") {
    return allowedDocIds.length > 0
      ? { connectedAccountId: "", allowedDocIds }
      : null;
  }
  return {
    connectedAccountId: connection.composio_connected_account_id,
    allowedDocIds,
  };
}

export function createExecuteCodeTool(
  context: AgentToolRuntimeContext,
  customToolKeys: string[],
) {
  return tool({
    description:
      "Run TypeScript for catalog tools, linked docs, and allowlisted Google Drive reads. Use callTool(toolKey, input), readLinkedDoc(docId) for Knowledge Docs / inventory, or composioExecute(slug, args) for GOOGLEDRIVE_* read-only slugs only. Prefer readLinkedDoc for stock/files. Return a plain object summary.",
    inputSchema: z.object({
      code: z
        .string()
        .describe(
          'TypeScript body of async execute(callTool). Example for inventory: const doc = await readLinkedDoc("doc-uuid"); return { text: doc.text }. Also: await composioExecute("GOOGLEDRIVE_FIND_FILE", args), fetch. Must return a plain object.',
        ),
    }),
    execute: async ({ code }) => {
      const [attached, composio] = await Promise.all([
        loadAttachedCodeTools(context, customToolKeys),
        loadComposioContext(context),
      ]);
      return runExecuteCode({
        code,
        tools: attached,
        context: {
          workspaceId: context.workspaceId,
          sessionId: context.sessionId,
          agentConfigId: context.agentConfigId,
        },
        composio:
          composio && composio.connectedAccountId
            ? composio
            : composio
              ? { connectedAccountId: "", allowedDocIds: composio.allowedDocIds }
              : null,
      });
    },
  });
}

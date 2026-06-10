import { tool } from "ai";
import type { ToolSet } from "ai";
import { jsonSchemaToZod } from "../../lib/json-schema-to-zod.js";
import { listWorkspaceCustomToolsByKeys } from "../../repositories/workspace-custom-tools.js";
import { resolveCustomToolEnv } from "../../services/custom-tool-env.js";
import { runCustomTool } from "../../services/tool-sandbox/run.js";
import type { AgentToolRuntimeContext } from "./shared.js";

export async function loadCustomTools(
  context: AgentToolRuntimeContext,
  customToolKeys: string[],
): Promise<ToolSet> {
  if (customToolKeys.length === 0) {
    return {};
  }

  const definitions = await listWorkspaceCustomToolsByKeys(
    context.workspaceId,
    customToolKeys,
  );
  const tools: ToolSet = {};

  for (const definition of definitions) {
    const env = await resolveCustomToolEnv(context.workspaceId, definition.required_env);
    const inputSchema = jsonSchemaToZod(definition.input_schema);
    tools[definition.tool_key] = tool({
      description: definition.description || definition.display_name,
      inputSchema,
      execute: async (input) => {
        return runCustomTool({
          source: definition.source_code,
          sourceHash: definition.source_hash,
          input,
          context: {
            workspaceId: context.workspaceId,
            sessionId: context.sessionId,
            agentConfigId: context.agentConfigId,
          },
          env,
        });
      },
    });
  }

  return tools;
}

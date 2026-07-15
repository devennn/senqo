import type { ToolSet } from "ai";
import { createTaskTool } from "../tools/create-task-tool.js";
import { createApplyConversationLabelsTool } from "../tools/apply-conversation-labels-tool.js";
import { createHandoffToHumanTool } from "../tools/handoff-to-human-tool.js";
import { createLoadSkillsTool } from "../tools/load-skills-tool.js";
import { loadCustomTools } from "../tools/custom-tools.js";
import type { AgentToolRuntimeContext } from "../tools/shared.js";
import type { BuiltinAgentToolKey } from "../../lib/builtin-agent-tool-keys.js";
import { BUILTIN_AGENT_TOOL_KEYS } from "../../lib/builtin-agent-tool-keys.js";

export async function getAgentTools(
  context: AgentToolRuntimeContext,
  enabledToolKeys: string[],
): Promise<ToolSet> {
  if (!Array.isArray(enabledToolKeys)) {
    return {};
  }

  const registry: Record<BuiltinAgentToolKey, ToolSet[BuiltinAgentToolKey]> = {
    create_task: createTaskTool(context),
    load_skills: createLoadSkillsTool(context),
    handoff_to_human: createHandoffToHumanTool(context),
    apply_conversation_labels: createApplyConversationLabelsTool(context),
  };

  const builtinKeys = enabledToolKeys.filter((key): key is BuiltinAgentToolKey =>
    (BUILTIN_AGENT_TOOL_KEYS as readonly string[]).includes(key),
  );
  const customKeys = enabledToolKeys.filter(
    (key) => !(BUILTIN_AGENT_TOOL_KEYS as readonly string[]).includes(key),
  );

  const builtinTools = builtinKeys.reduce<ToolSet>((acc, toolKey) => {
    acc[toolKey] = registry[toolKey];
    return acc;
  }, {});

  const customTools = await loadCustomTools(context, customKeys);
  return { ...builtinTools, ...customTools };
}

import type { ToolSet } from "ai";
import { createTaskTool } from "../tools/create-task-tool.js";
import { getWeatherTool } from "../tools/get-weather-tool.js";
import { createApplyConversationLabelsTool } from "../tools/apply-conversation-labels-tool.js";
import { createHandoffToHumanTool } from "../tools/handoff-to-human-tool.js";
import { createLoadSkillsTool } from "../tools/load-skills-tool.js";
import { createSendWhatsappMessageTool } from "../tools/send-whatsapp-message-tool.js";
import type { AgentToolRuntimeContext } from "../tools/shared.js";
import type { AgentToolKey } from "../../types/agent.js";

export function getAgentTools(
  context: AgentToolRuntimeContext,
  enabledToolKeys: string[],
): ToolSet {
  const registry: Record<AgentToolKey, ToolSet[AgentToolKey]> = {
    create_task: createTaskTool(context),
    load_skills: createLoadSkillsTool(context),
    get_weather: getWeatherTool,
    send_whatsapp_message: createSendWhatsappMessageTool(context),
    handoff_to_human: createHandoffToHumanTool(context),
    apply_conversation_labels: createApplyConversationLabelsTool(context),
  };

  if (!Array.isArray(enabledToolKeys) || enabledToolKeys.length === 0) {
    return {};
  }

  return enabledToolKeys.reduce<ToolSet>((acc, toolKey) => {
    if (!Object.hasOwn(registry, toolKey)) {
      return acc;
    }
    acc[toolKey] = registry[toolKey as AgentToolKey];
    return acc;
  }, {});
}

import { tool } from "ai";
import { z } from "zod";
import type { AgentToolRuntimeContext } from "./shared.js";
import { getAgentConfigById } from "../../repositories/agent.js";
import {
  replaceAssignmentsForConversation,
  validateLabelIdsForWorkspace,
} from "../../repositories/conversation-labels.js";

export function createApplyConversationLabelsTool(context: AgentToolRuntimeContext) {
  return tool({
    description:
      "Update AI-sourced labels for this conversation. Pass label UUIDs from the workspace catalog that match the thread. Replaces only labels the AI previously applied; user-applied labels are not removed. Pass an empty array to clear all AI labels.",
    inputSchema: z.object({
      labelIds: z.array(z.string().uuid()),
    }),
    execute: async ({ labelIds }) => {
      if (!context.agentConfigId) {
        return { ok: false, error: "Agent configuration is required for label assignment." };
      }
      const config = await getAgentConfigById(context.workspaceId, context.agentConfigId);
      if (!config?.auto_assign_conversation_labels) {
        return {
          ok: false,
          error: "Auto-assign conversation labels is disabled for this agent.",
        };
      }
      const valid = await validateLabelIdsForWorkspace(context.workspaceId, labelIds);
      if (!valid) {
        return { ok: false, error: "One or more label ids are invalid for this workspace." };
      }
      const updated = await replaceAssignmentsForConversation({
        workspaceId: context.workspaceId,
        conversationId: context.sessionId,
        labelIds,
        source: "ai",
      });
      if (!updated.ok) {
        return { ok: false, error: "Failed to save conversation labels." };
      }
      return { ok: true, appliedCount: labelIds.length };
    },
  });
}

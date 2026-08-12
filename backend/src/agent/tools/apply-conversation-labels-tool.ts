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
      "Required before final output when any catalog label definition matches this thread and AI labels are not already the correct full set. Pass every matching workspace label UUID in labelIds (one or many). Replaces only labels the AI previously applied; user-applied labels are not removed. Include still-relevant existing AI labels plus newly matching ones. Pass an empty array only to clear all AI labels. Do not skip this tool just to answer faster when a match is missing.",
    inputSchema: z.object({
      labelIds: z
        .array(z.string().uuid())
        .describe(
          "Full set of AI label UUIDs that should remain on this conversation after this turn. May include multiple labels when the message or recent thread matches more than one.",
        ),
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

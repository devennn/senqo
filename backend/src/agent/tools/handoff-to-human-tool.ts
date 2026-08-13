import { tool } from "ai";
import { z } from "zod";
import type { AgentToolRuntimeContext } from "./shared.js";
import { updateConversationHandlingMode } from "../../repositories/conversations.js";
import { createConversationMessage } from "../../repositories/whatsapp.js";
import { validateHandoffTopicEntryForAgent } from "../../repositories/handoff-topic-groups.js";
import { THREAD_EVENT_HANDOFF_TO_HUMAN } from "../../lib/conversation-thread-events.js";
import { scheduleHandoffNotify } from "../../services/handoff-notify.js";

export function createHandoffToHumanTool(context: AgentToolRuntimeContext) {
  return tool({
    description:
      "Hand this conversation off to a human teammate. After this, the AI will not reply until someone sets the chat back to AI mode. Use when the user asks for a person or the situation needs human judgment. If this agent has configured handoff topics in the system message, follow those when they match the conversation and pass topicEntryId for the matching topic.",
    inputSchema: z.object({
      reason: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Short reason shown to teammates in conversation history."),
      topicEntryId: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Id of the matching handoff topic entry from Handoff Guidance when a configured topic matches.",
        ),
    }),
    execute: async ({ reason, topicEntryId }) => {
      const trimmedReason = reason?.trim() ?? "";
      if (trimmedReason) {
        console.info(`[HandoffToHumanTool] reason=${trimmedReason}`);
      }

      if (context.dryRun) {
        let resolvedTopicEntryId: string | null = null;
        if (topicEntryId) {
          if (!context.agentConfigId) {
            return {
              ok: false,
              dryRun: true,
              error: "Cannot attach a handoff topic without an agent configuration.",
            };
          }
          const validated = await validateHandoffTopicEntryForAgent(
            context.workspaceId,
            context.agentConfigId,
            topicEntryId,
          );
          if (!validated.ok) {
            return { ok: false, dryRun: true, error: validated.message };
          }
          resolvedTopicEntryId = topicEntryId;
        }
        return {
          ok: true,
          dryRun: true,
          handoff: true,
          topicEntryId: resolvedTopicEntryId,
          reason: trimmedReason || null,
          message:
            "Dry run: handoff acknowledged without changing conversation handling mode.",
        };
      }

      let resolvedTopicEntryId: string | null = null;
      if (topicEntryId) {
        if (!context.agentConfigId) {
          return {
            ok: false,
            error: "Cannot attach a handoff topic without an agent configuration.",
          };
        }
        const validated = await validateHandoffTopicEntryForAgent(
          context.workspaceId,
          context.agentConfigId,
          topicEntryId,
        );
        if (!validated.ok) {
          return { ok: false, error: validated.message };
        }
        resolvedTopicEntryId = topicEntryId;
      }

      const updated = await updateConversationHandlingMode(
        context.workspaceId,
        context.sessionId,
        "human",
      );
      if (!updated.ok) {
        return { ok: false, error: "Failed to switch conversation to human handling." };
      }
      const saved = await createConversationMessage(
        context.workspaceId,
        context.sessionId,
        "assistant",
        "Human handoff",
        {
          thread_event: THREAD_EVENT_HANDOFF_TO_HUMAN,
          handoff_tool_reason: trimmedReason,
          ...(resolvedTopicEntryId
            ? { handoff_topic_entry_id: resolvedTopicEntryId }
            : {}),
          ...(context.agentRunId ? { agent_run_id: context.agentRunId } : {}),
        },
        null,
      );
      if (!saved.ok) {
        console.error(
          `[HandoffToHumanTool] Failed query: unable to save handoff thread event conversationId=${context.sessionId}`,
        );
      }
      // Alerts are best-effort; never gate the mode switch on WhatsApp notify.
      scheduleHandoffNotify({
        workspaceId: context.workspaceId,
        conversationId: context.sessionId,
        agentConfigId: context.agentConfigId,
        reason: trimmedReason || null,
      });
      return {
        ok: true,
        message:
          "Conversation is now in human handling mode. Do not send further automated WhatsApp replies unless the user is switched back to AI.",
      };
    },
  });
}

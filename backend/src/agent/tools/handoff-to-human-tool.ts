import { tool } from "ai";
import { z } from "zod";
import type { AgentToolRuntimeContext } from "./shared.js";
import { updateConversationHandlingMode } from "../../repositories/conversations.js";
import { createConversationMessage } from "../../repositories/whatsapp.js";
import { THREAD_EVENT_HANDOFF_TO_HUMAN } from "../../lib/conversation-thread-events.js";

export function createHandoffToHumanTool(context: AgentToolRuntimeContext) {
  return tool({
    description:
      "Hand this conversation off to a human teammate. After this, the AI will not reply until someone sets the chat back to AI mode. Use when the user asks for a person or the situation needs human judgment. If this agent has configured handoff topics in the system message, follow those when they match the conversation.",
    inputSchema: z.object({
      reason: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Short reason shown to teammates in conversation history."),
    }),
    execute: async ({ reason }) => {
      const trimmedReason = reason?.trim() ?? "";
      if (trimmedReason) {
        console.info(`[HandoffToHumanTool] reason=${trimmedReason}`);
      }
      const updated = await updateConversationHandlingMode(
        context.workspaceId,
        context.sessionId,
        "human"
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
          ...(context.agentRunId ? { agent_run_id: context.agentRunId } : {}),
        },
        null,
      );
      if (!saved.ok) {
        console.error(
          `[HandoffToHumanTool] Failed query: unable to save handoff thread event conversationId=${context.sessionId}`,
        );
      }
      return {
        ok: true,
        message:
          "Conversation is now in human handling mode. Do not send further automated WhatsApp replies unless the user is switched back to AI.",
      };
    },
  });
}

import { tool } from "ai";
import { z } from "zod";
import type { AgentToolRuntimeContext } from "../tools/shared.js";
import { sendAgentWhatsappMessage } from "../../services/agent-whatsapp.js";

export function createSendWhatsappMessageTool(context: AgentToolRuntimeContext) {
  return tool({
    description:
      "Send a WhatsApp message to the current conversation. Optionally attach a configured asset by exact filename when sharing that file helps (see Assets in system instructions).",
    inputSchema: z.object({
      message: z.string().min(1),
      assetFileName: z
        .string()
        .optional()
        .describe("Exact filename from the agent Assets list when you choose to send that file."),
    }),
    execute: async ({ message, assetFileName }) => {
      if (!context.agentConfigId) {
        return { ok: false, error: "No agent config id provided for sending." };
      }

      const sent = await sendAgentWhatsappMessage({
        workspaceId: context.workspaceId,
        conversationId: context.sessionId,
        agentConfigId: context.agentConfigId,
        message,
        assetFileName,
        ...(context.agentRunId ? { agentRunId: context.agentRunId } : {}),
      });

      if (!sent.ok) {
        return { ok: false, error: sent.error ?? "Failed to send message." };
      }

      return {
        ok: true,
        idMessage: sent.idMessage ?? null,
        sentAsset: assetFileName?.trim() ? assetFileName.trim() : null,
      };
    },
  });
}

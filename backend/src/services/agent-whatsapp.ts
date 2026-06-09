import { mediaKindFromMimeType } from "../lib/mime-media-kind.js";
import { estimateWhatsappTypingTimeMs } from "../lib/whatsapp-typing-time.js";
import {
  sendTextMessageCompat as sendTextMessage,
  sendMediaByUrl,
  uploadAndSendMedia,
  sendTyping,
} from "../services/whatsapp-client.js";
import { getAgentConfigById } from "../repositories/agent.js";
import {
  downloadAgentAssetBytes,
  getAgentAssetByFileNameForAgent,
} from "../repositories/workspace-asset-groups.js";
import {
  createConversationMessage,
  getConversationWhatsappChatId,
  resolveWhatsappConnectionForConversationAgentOutbound,
} from "../repositories/whatsapp.js";

const scope = "AgentWhatsappService";

async function notifyWhatsappTyping(
  connectionId: string,
  chatId: string,
  textForEstimate: string,
  typingType?: "recording",
): Promise<void> {
  const typingTime = estimateWhatsappTypingTimeMs(textForEstimate);
  try {
    await sendTyping(connectionId, {
      chatId,
      durationMs: typingTime,
      typingType,
    });
  } catch (error) {
    console.warn(
      `[${scope}/notifyWhatsappTyping] Failed query: ${String(error)} chatId=${chatId}`,
    );
  }
}

export async function sendAgentWhatsappMessage(input: {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
  message: string;
  agentRunId?: string;
  assetFileName?: string;
}): Promise<{ ok: boolean; idMessage?: string; error?: string }> {
  const message = input.message.trim();
  const assetFileName = input.assetFileName?.trim() ?? "";
  if (!message && !assetFileName) {
    return { ok: false, error: "Message or asset file name is required." };
  }

  const connection = await resolveWhatsappConnectionForConversationAgentOutbound(
    input.workspaceId,
    input.conversationId,
    input.agentConfigId,
  );
  if (!connection) {
    return { ok: false, error: "No WhatsApp connection attached to this agent." };
  }

  const chatId = await getConversationWhatsappChatId(input.workspaceId, input.conversationId);
  if (!chatId) {
    return { ok: false, error: "Conversation does not have a WhatsApp chat id." };
  }

  const baseMeta = {
    source: "agent_tool_send_whatsapp" as const,
    chatId,
    whatsappMessageId: "",
    whatsappConnectionId: connection.id,
    ...(input.agentRunId ? { agent_run_id: input.agentRunId } : {}),
  };

  try {
    if (assetFileName) {
      const agentConfig = await getAgentConfigById(input.workspaceId, input.agentConfigId);
      const groupIds = agentConfig?.asset_groups ?? [];
      const asset = await getAgentAssetByFileNameForAgent(
        input.workspaceId,
        groupIds,
        assetFileName,
      );
      if (!asset) {
        return { ok: false, error: `Asset not found: ${assetFileName}` };
      }

      const bytes = await downloadAgentAssetBytes(asset.storage_path);
      if (!bytes) {
        return { ok: false, error: "Could not load asset file." };
      }

      const mediaKind = mediaKindFromMimeType(asset.mime_type);
      const caption = message || asset.file_name;
      if (mediaKind === "audio") {
        await notifyWhatsappTyping(connection.id, chatId, "", "recording");
      } else {
        await notifyWhatsappTyping(connection.id, chatId, caption);
      }
      const sent = await uploadAndSendMedia(connection.id, {
        chatId,
        fileName: asset.file_name,
        mimeType: asset.mime_type || "application/octet-stream",
        data: bytes,
        caption: mediaKind === "audio" ? undefined : caption,
      });

      await createConversationMessage(
        input.workspaceId,
        input.conversationId,
        "assistant",
        caption,
        {
          ...baseMeta,
          whatsappMessageId: sent.messageId,
          mediaKind,
          media: {
            fileName: asset.file_name,
            mimeType: asset.mime_type,
            caption,
          },
        },
        "ai_agent",
      );

      console.info(
        `[${scope}/sendAgentWhatsappMessage] Success: userId=${input.workspaceId} conversationId=${input.conversationId} asset=${asset.file_name}`,
      );
      return { ok: true, idMessage: sent.messageId };
    }

    await notifyWhatsappTyping(connection.id, chatId, message);
    const sent = await sendTextMessage(connection.id, { chatId, text: message });

    await createConversationMessage(
      input.workspaceId,
      input.conversationId,
      "assistant",
      message,
      { ...baseMeta, whatsappMessageId: sent.messageId },
      "ai_agent",
    );

    console.info(
      `[${scope}/sendAgentWhatsappMessage] Success: userId=${input.workspaceId} conversationId=${input.conversationId}`,
    );
    return { ok: true, idMessage: sent.messageId };
  } catch (error) {
    console.error(`[${scope}/sendAgentWhatsappMessage] Unexpected error: ${String(error)}`);
    return { ok: false, error: "Failed to send WhatsApp message." };
  }
}

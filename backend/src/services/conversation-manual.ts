import {
  sendTextMessageCompat as sendTextMessage,
  uploadAndSendMedia,
} from "../services/whatsapp-client.js";
import {
  persistHumanOutboundMediaToAgentSession,
  persistHumanOutboundTextToAgentSession,
} from "./conversation-persist.js";
import {
  createConversationMessage,
  getManualWhatsappSendTarget,
} from "../repositories/whatsapp.js";
import type { ManualConversationMediaInput } from "../types/repositories.js";

const scope = "ConversationManualService";

export async function sendManualConversationMessage(input: {
  workspaceId: string;
  conversationId: string;
  message: string;
}): Promise<{ ok: true; idMessage: string } | { ok: false; error: string }> {
  const message = input.message.trim();
  if (!message) {
    return { ok: false, error: "Message is required." };
  }

  const target = await getManualWhatsappSendTarget(input.workspaceId, input.conversationId);
  if (!target) {
    return { ok: false, error: "This WhatsApp connection is not connected. Reconnect it before sending a message." };
  }

  try {
    const sent = await sendTextMessage(target.connection.id, {
      chatId: target.chatId,
      text: message,
    });

    const saved = await createConversationMessage(
      input.workspaceId,
      input.conversationId,
      "assistant",
      message,
      {
        source: "manual_conversation_send",
        chatId: target.chatId,
        whatsappMessageId: sent.messageId,
        whatsappConnectionId: target.connection.id,
      },
      "human"
    );

    if (!saved.ok) {
      return { ok: false, error: "Message sent but failed to save to the database." };
    }

    const mirrored = await persistHumanOutboundTextToAgentSession({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      message,
      chatId: target.chatId,
      whatsappMessageId: sent.messageId,
      whatsappConnectionId: target.connection.id,
      source: "manual_conversation_send",
    });
    if (!mirrored.ok) {
      console.error(
        `[${scope}/sendManualConversationMessage] Failed query: agent mirror failed conversationId=${input.conversationId}`
      );
    }

    console.info(
      `[${scope}/sendManualConversationMessage] Success: userId=${input.workspaceId} conversationId=${input.conversationId}`
    );
    return { ok: true, idMessage: sent.messageId };
  } catch (error) {
    console.error(`[${scope}/sendManualConversationMessage] Unexpected error: ${String(error)}`);
    return { ok: false, error: "Failed to send WhatsApp message." };
  }
}

function contentForMediaMessage(input: ManualConversationMediaInput): string {
  if (input.mediaKind === "audio") {
    return "";
  }

  const caption = input.caption?.trim() ?? "";
  return caption || input.fileName;
}

export async function sendManualConversationMedia(
  input: ManualConversationMediaInput
): Promise<{ ok: true; idMessage: string; urlFile: string } | { ok: false; error: string }> {
  if (!input.fileName.trim()) {
    return { ok: false, error: "File name is required." };
  }

  const target = await getManualWhatsappSendTarget(input.workspaceId, input.conversationId);
  if (!target) {
    return { ok: false, error: "This WhatsApp connection is not connected. Reconnect it before sending an attachment." };
  }

  const caption = input.mediaKind === "audio" ? "" : input.caption?.trim() ?? "";

  try {
    const sent = await uploadAndSendMedia(target.connection.id, {
      chatId: target.chatId,
      fileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      data: input.data,
      caption: caption || undefined,
    });

    const saved = await createConversationMessage(
      input.workspaceId,
      input.conversationId,
      "assistant",
      contentForMediaMessage(input),
      {
        source: "manual_conversation_media_send",
        chatId: target.chatId,
        whatsappMessageId: sent.messageId,
        whatsappConnectionId: target.connection.id,
        mediaKind: input.mediaKind,
        media: {
          fileName: input.fileName,
          mimeType: input.mimeType || "application/octet-stream",
          caption,
        },
      },
      "human"
    );

    if (!saved.ok) {
      return { ok: false, error: "Attachment sent but failed to save to the database." };
    }

    const mirrored = await persistHumanOutboundMediaToAgentSession({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      chatId: target.chatId,
      whatsappMessageId: sent.messageId,
      whatsappConnectionId: target.connection.id,
      fileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      mediaKind: input.mediaKind,
      caption,
      sourceUrl: "",
      source: "manual_conversation_media_send",
    });
    if (!mirrored.ok) {
      console.error(
        `[${scope}/sendManualConversationMedia] Failed query: agent mirror failed conversationId=${input.conversationId}`
      );
    }

    console.info(
      `[${scope}/sendManualConversationMedia] Success: userId=${input.workspaceId} conversationId=${input.conversationId}`
    );
    return { ok: true, idMessage: sent.messageId, urlFile: "" };
  } catch (error) {
    console.error(`[${scope}/sendManualConversationMedia] Unexpected error: ${String(error)}`);
    return { ok: false, error: "Failed to send WhatsApp attachment." };
  }
}

import { sendTextMessageCompat as sendTextMessage, sendMediaByUrl } from "../services/whatsapp-client.js";
import { getLeadContactForWorkspace } from "../repositories/leads.js";
import {
  createConversationMessage,
  findConnectionByAgentConfigId,
  findOrCreateConversationByWhatsappChatId,
  resolveWhatsappConnectionForConversationAgentOutbound,
} from "../repositories/whatsapp.js";
import {
  persistHumanOutboundMediaToAgentSession,
  persistHumanOutboundTextToAgentSession,
} from "./conversation-persist.js";
import { describePublicUrlAttachment } from "../lib/public-url-attachment.js";
import { phoneToWhatsappChatId } from "../lib/whatsapp-chat-id.js";

const scope = "TaskExecuteManual";

export async function sendScheduledTaskAsManualWhatsapp(input: {
  workspaceId: string;
  agentConfigId: string;
  leadId: string;
  instruction: string;
  fileUrl?: string | null;
}): Promise<{ ok: true; conversationId: string; idMessage: string } | { ok: false; error: string }> {
  const text = input.instruction
    .replace(/%0D%0A/gi, "\n")
    .replace(/%0A/gi, "\n")
    .replace(/%0D/gi, "\n")
    .trim();
  if (!text) {
    return { ok: false, error: "Instruction is empty." };
  }

  const leadContact = await getLeadContactForWorkspace(input.workspaceId, input.leadId);
  if (!leadContact) {
    return { ok: false, error: "Lead or contact not found." };
  }

  const chatId = phoneToWhatsappChatId(leadContact.phone);
  if (!chatId) {
    return { ok: false, error: "Invalid contact phone for WhatsApp." };
  }

  const connection = await findConnectionByAgentConfigId(input.workspaceId, input.agentConfigId);
  if (!connection.id) {
    return { ok: false, error: "No WhatsApp connection attached to this agent." };
  }

  const displayName = `${leadContact.firstName} ${leadContact.lastName}`.trim() || "WhatsApp Contact";
  const conversationId = await findOrCreateConversationByWhatsappChatId(
    input.workspaceId,
    connection.id,
    leadContact.contactId,
    displayName,
    chatId,
  );
  if (!conversationId) {
    return { ok: false, error: "Could not resolve conversation for this lead." };
  }

  const sendConnection = await resolveWhatsappConnectionForConversationAgentOutbound(
    input.workspaceId,
    conversationId,
    input.agentConfigId,
  );
  if (!sendConnection) {
    return {
      ok: false,
      error: "Could not resolve WhatsApp credentials for this conversation's line.",
    };
  }

  try {
    const fileUrl = input.fileUrl?.trim() ?? "";
    console.info(`[${scope}/sendScheduledTaskAsManualWhatsapp] Outgoing text payload`, {
      workspaceId: input.workspaceId,
      agentConfigId: input.agentConfigId,
      leadId: input.leadId,
      chatId,
      messagePreview: text.slice(0, 500),
      messageLength: text.length,
      hasEncodedNewline: text.includes("%0A"),
    });
    const sent = await sendTextMessage(sendConnection.id, { chatId, text });
    let fileMessageId: string | null = null;
    let attachmentGuess: ReturnType<typeof describePublicUrlAttachment> | null = null;
    if (fileUrl.length > 0) {
      attachmentGuess = describePublicUrlAttachment(fileUrl);
      console.info(`[${scope}/sendScheduledTaskAsManualWhatsapp] Outgoing file payload`, {
        workspaceId: input.workspaceId,
        agentConfigId: input.agentConfigId,
        leadId: input.leadId,
        chatId,
        fileUrl,
      });
      const sentFile = await sendMediaByUrl(sendConnection.id, {
        chatId,
        url: fileUrl,
        fileName: attachmentGuess.fileName,
        mimeType: attachmentGuess.mimeType,
      });
      fileMessageId = sentFile.messageId;
    }

    const baseMeta = {
      source: "task_execute_manual" as const,
      chatId,
      whatsappConnectionId: sendConnection.id,
    };

    if (fileMessageId && attachmentGuess) {
      const savedText = await createConversationMessage(
        input.workspaceId,
        conversationId,
        "assistant",
        text,
        {
          ...baseMeta,
          whatsappMessageId: sent.messageId,
        },
        "human",
        { waMessageId: sent.messageId || null },
      );
      if (!savedText.ok) {
        return { ok: false, error: "Message sent but failed to save to the database." };
      }

      const savedFile = await createConversationMessage(
        input.workspaceId,
        conversationId,
        "assistant",
        "",
        {
          ...baseMeta,
          whatsappMessageId: fileMessageId,
          fileUrl,
          mediaKind: attachmentGuess.mediaKind,
          media: {
            fileName: attachmentGuess.fileName,
            mimeType: attachmentGuess.mimeType,
            caption: "",
            sourceUrl: fileUrl,
          },
        },
        "human",
        { waMessageId: fileMessageId || null },
      );
      if (!savedFile.ok) {
        return { ok: false, error: "Message sent but failed to save the attachment to the database." };
      }
    } else {
      const saved = await createConversationMessage(
        input.workspaceId,
        conversationId,
        "assistant",
        text,
        {
          ...baseMeta,
          whatsappMessageId: sent.messageId,
          fileUrl: fileUrl.length > 0 ? fileUrl : null,
          whatsappFileMessageId: fileMessageId,
        },
        "human",
        { waMessageId: sent.messageId || null },
      );
      if (!saved.ok) {
        return { ok: false, error: "Message sent but failed to save to the database." };
      }
    }

    const textMirror = await persistHumanOutboundTextToAgentSession({
      workspaceId: input.workspaceId,
      conversationId,
      message: text,
      chatId,
      whatsappMessageId: sent.messageId,
      whatsappConnectionId: sendConnection.id,
      source: "task_execute_manual",
    });
    if (!textMirror.ok) {
      console.error(
        `[${scope}/sendScheduledTaskAsManualWhatsapp] Failed query: agent text mirror failed conversationId=${conversationId}`,
      );
    }

    if (fileMessageId && attachmentGuess) {
      const mediaMirror = await persistHumanOutboundMediaToAgentSession({
        workspaceId: input.workspaceId,
        conversationId,
        chatId,
        whatsappMessageId: fileMessageId,
        whatsappConnectionId: sendConnection.id,
        fileName: attachmentGuess.fileName,
        mimeType: attachmentGuess.mimeType,
        mediaKind: attachmentGuess.mediaKind,
        caption: "",
        sourceUrl: fileUrl,
        source: "task_execute_manual",
      });
      if (!mediaMirror.ok) {
        console.error(
          `[${scope}/sendScheduledTaskAsManualWhatsapp] Failed query: agent file mirror failed conversationId=${conversationId}`,
        );
      }
    }

    console.info(
      `[${scope}/sendScheduledTaskAsManualWhatsapp] Success: userId=${input.workspaceId} conversationId=${conversationId}`,
    );
    return { ok: true, conversationId, idMessage: sent.messageId };
  } catch (error) {
    console.error(`[${scope}/sendScheduledTaskAsManualWhatsapp] Unexpected error: ${String(error)}`);
    return { ok: false, error: "Failed to send WhatsApp message." };
  }
}

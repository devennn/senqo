import { asStorableAgentMessageContent } from "../agent/messages.js";
import { isInboundImageMimeType } from "../lib/inbound-media-to-model-parts.js";
import type { StoredUserImageUrlPart, StoredUserTextPart } from "../types/agent-multimodal.js";
import { insertAgentMessages } from "../repositories/agent-messages.js";
import {
  createAgentSession,
  findAgentSession,
  touchAgentSession,
} from "../repositories/agent-sessions.js";
import type {
  AgentMessageRole,
  ConversationAgentMirrorPersistResult,
  HumanOutboundMediaMirrorStubFields,
} from "../types/repositories.js";

const scope = "ConversationPersist";

export const OPERATOR_SENT_PREFIX = "[Operator sent via WhatsApp]";

async function ensureSessionAndInsertAgentMessage(input: {
  workspaceId: string;
  conversationId: string;
  role: AgentMessageRole;
  content: unknown;
  providerOptions: Record<string, unknown>;
}): Promise<ConversationAgentMirrorPersistResult> {
  let session = await findAgentSession(input.workspaceId, input.conversationId);
  if (!session) {
    await createAgentSession({
      workspaceId: input.workspaceId,
      sessionId: input.conversationId,
      metadata: { source: "outbound_mirror" },
    });
    // Re-fetch regardless of createAgentSession result — handles duplicate key race
    session = await findAgentSession(input.workspaceId, input.conversationId);
    if (!session) {
      console.error(
        `[${scope}/ensureSessionAndInsertAgentMessage] Failed query: session not found after create workspaceId=${input.workspaceId} conversationId=${input.conversationId}`
      );
      return { ok: false, error: "Failed to ensure agent session." };
    }
  }

  const persisted = await insertAgentMessages(
    [
      {
        workspaceId: input.workspaceId,
        sessionId: input.conversationId,
        role: input.role,
        content: asStorableAgentMessageContent(input.role, input.content),
        providerOptions: input.providerOptions,
      },
    ],
    { ignoreDuplicates: true }
  );

  if (!persisted) {
    console.error(
      `[${scope}/ensureSessionAndInsertAgentMessage] Failed query: insert failed workspaceId=${input.workspaceId} conversationId=${input.conversationId}`
    );
    return { ok: false, error: "Failed to insert agent message." };
  }

  await touchAgentSession(input.workspaceId, input.conversationId);

  console.info(
    `[${scope}/ensureSessionAndInsertAgentMessage] Success: workspaceId=${input.workspaceId} conversationId=${input.conversationId}`
  );
  return { ok: true };
}

export async function persistHumanOutboundTextToAgentSession(input: {
  workspaceId: string;
  conversationId: string;
  message: string;
  chatId: string;
  whatsappMessageId: string;
  whatsappConnectionId: string;
  source: string;
}): Promise<ConversationAgentMirrorPersistResult> {
  return ensureSessionAndInsertAgentMessage({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    role: "assistant",
    content: `${OPERATOR_SENT_PREFIX}\n${input.message}`,
    providerOptions: {
      source: input.source,
      chatId: input.chatId,
      whatsappMessageId: input.whatsappMessageId,
      whatsappConnectionId: input.whatsappConnectionId,
    },
  });
}

export async function persistHumanOutboundMediaToAgentSession(input: {
  workspaceId: string;
  conversationId: string;
  chatId: string;
  whatsappMessageId: string;
  whatsappConnectionId: string;
  fileName: string;
  mimeType: string;
  mediaKind: "file" | "image" | "audio";
  caption: string;
  sourceUrl: string;
  source: string;
}): Promise<ConversationAgentMirrorPersistResult> {
  const sourceUrl = input.sourceUrl.trim();
  const useVisionMultimodalOutbound =
    input.mediaKind === "image" &&
    isInboundImageMimeType(input.mimeType) &&
    sourceUrl.length > 0;

  if (useVisionMultimodalOutbound) {
    const textBody = humanOutboundMediaDescription(input);
    const textBlock = `${OPERATOR_SENT_PREFIX}\n${textBody}`;
    const textPart: StoredUserTextPart = { type: "text", text: textBlock };
    const imagePart: StoredUserImageUrlPart = {
      type: "image_url",
      image_url: { url: sourceUrl },
    };
    const multimodalContent: Array<StoredUserTextPart | StoredUserImageUrlPart> = [
      textPart,
      imagePart,
    ];
    return ensureSessionAndInsertAgentMessage({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      role: "assistant",
      content: multimodalContent,
      providerOptions: {
        source: input.source,
        chatId: input.chatId,
        whatsappMessageId: input.whatsappMessageId,
        whatsappConnectionId: input.whatsappConnectionId,
        mediaKind: input.mediaKind,
      },
    });
  }

  const content = buildMediaContent(input);
  return ensureSessionAndInsertAgentMessage({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    role: "assistant",
    content,
    providerOptions: {
      source: input.source,
      chatId: input.chatId,
      whatsappMessageId: input.whatsappMessageId,
      whatsappConnectionId: input.whatsappConnectionId,
      mediaKind: input.mediaKind,
    },
  });
}

function humanOutboundMediaDescription(input: HumanOutboundMediaMirrorStubFields): string {
  const caption = input.caption.trim();
  const fileName = input.fileName.trim();

  if (input.mediaKind === "audio") {
    return fileName ? `Voice note (${fileName})` : "Voice note";
  }

  return (
    [caption, fileName].filter((s) => s.length > 0).join("\n") ||
    (input.mediaKind === "image"
      ? "Image sent by a teammate via WhatsApp."
      : "Attachment sent by a teammate via WhatsApp.")
  );
}

function buildMediaContent(input: HumanOutboundMediaMirrorStubFields): string {
  return `${OPERATOR_SENT_PREFIX}\n${humanOutboundMediaDescription(input)}`;
}

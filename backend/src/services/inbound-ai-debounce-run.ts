import { runAgentSession } from "../agent/agent.js";
import {
  INBOUND_AI_MAX_MEDIA_PARTS,
  buildInboundUserMediaWireParts,
  isInboundImageMimeType,
} from "../lib/inbound-media-to-model-parts.js";
import {
  buildInboundAiUserTextForRun,
  collectTrailingUserBlockForAi,
  isBareWhatsAppTypePlaceholderLine,
} from "../lib/trailing-user-messages.js";
import { THREAD_EVENT_HANDOFF_TO_HUMAN } from "../lib/conversation-thread-events.js";
import { scheduleHandoffNotify } from "./handoff-notify.js";
import { resolveInboundMediaSigned } from "../lib/inbound-media-resolve.js";
import {
  getConversationHandlingMode,
  listConversationMessagesBareForAi,
  updateConversationHandlingMode,
} from "../repositories/conversations.js";
import { getContactIsTestForConversation } from "../repositories/contacts.js";
import { clearInboundAiDebouncePending } from "../repositories/inbound-ai-debounce-pending.js";
import {
  createConversationMessage,
  getWhatsappConnectionModeForInboundAi,
} from "../repositories/whatsapp.js";
import { normalizeWhatsappConnectionMode, shouldRunInboundAi } from "./inbound-ai-mode.js";

const logScope = "InboundAiDebounceRun";

/** Dashboard thread summary under Human handoff (same metadata key as `handoff_to_human` tool). */
const INBOUND_UNSUPPORTED_MEDIA_HANDOFF_REASON =
  "Only text and image attachments are supported for AI. Voice notes, video, documents, and other non-image media are not; handle manually.";

export type InboundDebouncedRunInput = {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
  whatsappConnectionId?: string;
};

/**
 * Runs after debounce quiet period: batch trailing user `messages` rows and invoke the agent once.
 */
export async function executeInboundDebouncedAiRun(input: InboundDebouncedRunInput): Promise<{
  ok: boolean;
  noop?: boolean;
  error?: string;
}> {
  const handlingMode = await getConversationHandlingMode(input.workspaceId, input.conversationId);
  const isTestContact = await getContactIsTestForConversation(input.workspaceId, input.conversationId);
  const mode = normalizeWhatsappConnectionMode(
    await getWhatsappConnectionModeForInboundAi(
      input.workspaceId,
      input.conversationId,
      input.agentConfigId,
      input.whatsappConnectionId,
    ),
  );
  const normalizedHandling = handlingMode ?? "ai";
  const policySkipInference = !shouldRunInboundAi(mode, isTestContact, normalizedHandling);
  const skipReason =
    normalizedHandling === "human"
      ? "conversation is in human handling mode"
      : mode === "inactive"
        ? "connection mode is inactive"
        : mode === "testing" && !isTestContact
          ? "connection mode is testing and contact is not marked as test"
          : "inference skipped by policy";

  const bare = await listConversationMessagesBareForAi(input.workspaceId, input.conversationId);
  const { textLines, mediaDescriptors, newestUserCreatedAt } = collectTrailingUserBlockForAi(bare);
  const substantiveTextLines = textLines.filter((l) => !isBareWhatsAppTypePlaceholderLine(l));
  const hasMedia = mediaDescriptors.length > 0;
  if (substantiveTextLines.length === 0 && !hasMedia) {
    console.info(`[${logScope}] Noop: empty trailing user texts and no supported media conversationId=${input.conversationId}`);
    void clearInboundAiDebouncePending(input.conversationId);
    return { ok: true, noop: true };
  }

  const messageTimestamp = newestUserCreatedAt ?? undefined;
  let message = buildInboundAiUserTextForRun(textLines);

  const unsupportedAiMediaDescriptors = mediaDescriptors.filter(
    (d) => !isInboundImageMimeType(d.mimeType),
  );
  const imageDescriptors = mediaDescriptors.filter((d) => isInboundImageMimeType(d.mimeType));

  if (unsupportedAiMediaDescriptors.length > 0) {
    message +=
      "\n\n[System: Customer sent content that is not plain text or an image (for example voice notes, video, documents, or other files). The AI does not process that media. Conversation switched to human handling.]";
    console.info(
      `[${logScope}] Unsupported inbound media handoff conversationId=${input.conversationId} count=${unsupportedAiMediaDescriptors.length}`,
    );
    const handoffUpdated = await updateConversationHandlingMode(
      input.workspaceId,
      input.conversationId,
      "human",
    );
    if (!handoffUpdated.ok) {
      console.error(
        `[${logScope}] Failed to set human handling after unsupported media conversationId=${input.conversationId}`,
      );
    } else {
      const handoffThreadSaved = await createConversationMessage(
        input.workspaceId,
        input.conversationId,
        "assistant",
        "Human handoff",
        {
          thread_event: THREAD_EVENT_HANDOFF_TO_HUMAN,
          handoff_tool_reason: INBOUND_UNSUPPORTED_MEDIA_HANDOFF_REASON,
        },
        null,
      );
      if (!handoffThreadSaved.ok) {
        console.error(
          `[${logScope}] Failed query: unable to save handoff thread event conversationId=${input.conversationId}`,
        );
      }
      scheduleHandoffNotify({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        agentConfigId: input.agentConfigId,
        reason: INBOUND_UNSUPPORTED_MEDIA_HANDOFF_REASON,
      });
    }
    try {
      const result = await runAgentSession({
        workspaceId: input.workspaceId,
        sessionId: input.conversationId,
        agentConfigId: input.agentConfigId,
        message,
        messageTimestamp,
        dryRun: false,
        skipInference: true,
        skipInferenceReason: "inbound_unsupported_media_attachment",
        userMediaParts: undefined,
      });
      if (!result) {
        console.error(`[${logScope}] Unexpected error: runAgentSession returned null after unsupported media`);
        return { ok: false, error: "agent_null" };
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      console.error(`[${logScope}] Unexpected error: ${messageText}`);
      return { ok: false, error: messageText };
    }
    void clearInboundAiDebouncePending(input.conversationId);
    return { ok: true };
  }

  const resolvedMedia =
    imageDescriptors.length > 0
      ? await resolveInboundMediaSigned(input.workspaceId, imageDescriptors)
      : [];
  const imageParts = buildInboundUserMediaWireParts(resolvedMedia);
  const userMediaParts = imageParts.slice(0, INBOUND_AI_MAX_MEDIA_PARTS);

  const hasRenderableMedia = mediaDescriptors.length > 0;
  if (hasRenderableMedia && userMediaParts.length === 0) {
    message +=
      "\n\n[System: the customer sent attachment(s), but they could not be attached for this AI run.]";
  }

  const skipInference = policySkipInference;

  if (skipInference) {
    console.info(
      `[${logScope}] Contact not processed for AI reply because ${skipReason}; inbound will still be saved to agent session conversationId=${input.conversationId}`
    );
  } else if (mode === "testing" && isTestContact) {
    console.info(
      `[${logScope}] Testing mode: processing test contact conversationId=${input.conversationId}`
    );
  }

  try {
    const result = await runAgentSession({
      workspaceId: input.workspaceId,
      sessionId: input.conversationId,
      agentConfigId: input.agentConfigId,
      message,
      messageTimestamp,
      dryRun: false,
      skipInference,
      skipInferenceReason: skipInference ? skipReason : undefined,
      userMediaParts: userMediaParts.length > 0 ? userMediaParts : undefined,
    });
    if (!result) {
      console.error(`[${logScope}] Unexpected error: runAgentSession returned null`);
      return { ok: false, error: "agent_null" };
    }
    void clearInboundAiDebouncePending(input.conversationId);
    console.info(`[${logScope}] Success: conversationId=${input.conversationId}`);
    return { ok: true };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error(`[${logScope}] Unexpected error: ${messageText}`);
    return { ok: false, error: messageText };
  }
}

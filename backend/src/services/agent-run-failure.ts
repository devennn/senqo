import { THREAD_EVENT_AGENT_ERROR } from "../lib/conversation-thread-events.js";
import { updateConversationHandlingMode } from "../repositories/conversations.js";
import { listErrorAlertSubscriberUserIds } from "../repositories/error-alert-subscribers.js";
import { createConversationMessage } from "../repositories/whatsapp.js";
import { scheduleHandoffNotify } from "./handoff-notify.js";

const scope = "AgentRunFailure";

const AGENT_ERROR_THREAD_CONTENT = "AI could not reply";
const AGENT_ERROR_NOTIFY_REASON = "AI could not reply";
const MAX_AGENT_ERROR_LENGTH = 2000;

function truncateErrorMessage(errorMessage: string): string {
  return errorMessage.length > MAX_AGENT_ERROR_LENGTH
    ? `${errorMessage.slice(0, MAX_AGENT_ERROR_LENGTH)}\u2026`
    : errorMessage;
}

/**
 * An agent run that fails must never produce a customer-facing reply. Switch the
 * conversation to human handling, leave an operator-only thread event with the
 * error, and alert team members opted in to AI error alerts (default: nobody).
 */
export async function handoffAfterAgentRunFailure(input: {
  workspaceId: string;
  conversationId: string;
  agentConfigId?: string | null;
  errorMessage: string;
}): Promise<void> {
  const errorMessage = truncateErrorMessage(
    input.errorMessage.trim() || "Agent run failed",
  );

  const updated = await updateConversationHandlingMode(
    input.workspaceId,
    input.conversationId,
    "human",
  );
  if (!updated.ok) {
    console.error(
      `[${scope}/handoffAfterAgentRunFailure] Failed query: unable to switch handling mode conversationId=${input.conversationId}`,
    );
    return;
  }

  const eventSaved = await createConversationMessage(
    input.workspaceId,
    input.conversationId,
    "assistant",
    AGENT_ERROR_THREAD_CONTENT,
    {
      thread_event: THREAD_EVENT_AGENT_ERROR,
      agent_error_message: errorMessage,
    },
    null,
  );
  if (!eventSaved.ok) {
    console.error(
      `[${scope}/handoffAfterAgentRunFailure] Failed query: unable to save agent error event conversationId=${input.conversationId}`,
    );
  }

  const recipientUserIds = await listErrorAlertSubscriberUserIds(input.workspaceId);
  scheduleHandoffNotify({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    agentConfigId: input.agentConfigId,
    reason: AGENT_ERROR_NOTIFY_REASON,
    recipientUserIds,
  });

  console.info(
    `[${scope}/handoffAfterAgentRunFailure] Success: conversationId=${input.conversationId}`,
  );
}

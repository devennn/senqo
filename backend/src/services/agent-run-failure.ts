import {
  AGENT_RUN_LOG_KIND_AGENT_ERROR,
  AGENT_RUN_LOG_SOURCE,
} from "../lib/agent-run-log.js";
import { THREAD_EVENT_AGENT_ERROR } from "../lib/conversation-thread-events.js";
import { insertAgentMessages } from "../repositories/agent-messages.js";
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
 * Stores the provider error verbatim in the conversation's agent transcript so
 * operators can read it in Agent Logs. The thread only carries a short,
 * non-technical summary; run-log rows are excluded from model history on later
 * runs via their provider options.
 */
async function recordAgentErrorLog(input: {
  workspaceId: string;
  conversationId: string;
  agentConfigId?: string | null;
  errorMessage: string;
  dryRun: boolean;
}): Promise<void> {
  const saved = await insertAgentMessages([
    {
      workspaceId: input.workspaceId,
      sessionId: input.conversationId,
      role: "assistant",
      content: {
        type: AGENT_RUN_LOG_KIND_AGENT_ERROR,
        error: input.errorMessage,
        dry_run: input.dryRun,
        ...(input.agentConfigId ? { agent_config_id: input.agentConfigId } : {}),
      },
      providerOptions: {
        source: AGENT_RUN_LOG_SOURCE,
        kind: AGENT_RUN_LOG_KIND_AGENT_ERROR,
      },
    },
  ]);
  if (!saved) {
    console.error(
      `[${scope}/recordAgentErrorLog] Failed query: unable to save agent error log conversationId=${input.conversationId}`,
    );
  }
}

/**
 * An agent run that fails must never produce a customer-facing reply. Switch the
 * conversation to human handling, leave an operator-only thread event with a
 * non-technical summary (the verbose provider error goes to Agent Logs), and
 * alert team members opted in to AI error alerts (default: nobody).
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

  await recordAgentErrorLog({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    agentConfigId: input.agentConfigId,
    errorMessage,
    dryRun: false,
  });

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

/**
 * Dry runs: a failed run must not send a customer-facing reply, must not change
 * conversation handling, and must not alert teammates. Leave an operator-only
 * dry-run thread event with a non-technical summary; the verbose provider error
 * goes to Agent Logs.
 */
export async function recordDryRunAgentFailure(input: {
  workspaceId: string;
  conversationId: string;
  errorMessage: string;
}): Promise<void> {
  const errorMessage = truncateErrorMessage(
    input.errorMessage.trim() || "Agent run failed",
  );

  await recordAgentErrorLog({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    errorMessage,
    dryRun: true,
  });

  const eventSaved = await createConversationMessage(
    input.workspaceId,
    input.conversationId,
    "assistant",
    AGENT_ERROR_THREAD_CONTENT,
    {
      thread_event: THREAD_EVENT_AGENT_ERROR,
      dry_run: true,
    },
    null,
  );
  if (!eventSaved.ok) {
    console.error(
      `[${scope}/recordDryRunAgentFailure] Failed query: unable to save dry-run agent error event conversationId=${input.conversationId}`,
    );
    return;
  }

  console.info(
    `[${scope}/recordDryRunAgentFailure] Success: conversationId=${input.conversationId}`,
  );
}

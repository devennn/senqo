import type { ConversationMessage } from "@/types/repositories";

function getAgentRunId(message: ConversationMessage): string | null {
  const meta = message.metadata;
  const v = meta && typeof meta === "object" ? (meta as Record<string, unknown>).agent_run_id : null;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export function getOperatorAiReasoning(message: ConversationMessage): string | null {
  const meta = message.metadata;
  const v = meta && typeof meta === "object" ? (meta as Record<string, unknown>).ai_reasoning : null;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/** Show once per agent run: last consecutive AI bubble that shares the same `agent_run_id`. */
export function shouldShowOperatorAiReasoningFooter(
  message: ConversationMessage,
  nextMessage: ConversationMessage | null,
): boolean {
  if (message.outgoing_sender_type !== "ai_agent") return false;
  const text = getOperatorAiReasoning(message);
  if (!text) return false;
  const runId = getAgentRunId(message);
  const next = nextMessage;
  if (!next || next.outgoing_sender_type !== "ai_agent") return true;
  const nextRunId = getAgentRunId(next);
  if (runId && nextRunId && runId === nextRunId) return false;
  return true;
}

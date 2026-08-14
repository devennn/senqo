import type { ConversationMessage } from "@/types/repositories";

export type ConversationKnowledgeKind = "context" | "template" | "skill" | "handoff";

export type ConversationKnowledgeRef = {
  kind: ConversationKnowledgeKind;
  label: string;
  id?: string;
  groupId?: string;
};

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

export function getOperatorAiSources(message: ConversationMessage): ConversationKnowledgeRef[] {
  const meta = message.metadata;
  const raw = meta && typeof meta === "object" ? (meta as Record<string, unknown>).ai_sources : null;
  if (!Array.isArray(raw)) return [];
  const sources: ConversationKnowledgeRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = row.kind;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (
      (kind === "context" || kind === "template" || kind === "skill" || kind === "handoff") &&
      label
    ) {
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : undefined;
      const groupId =
        typeof row.groupId === "string" && row.groupId.trim() ? row.groupId.trim() : undefined;
      sources.push({ kind, label, ...(id ? { id } : {}), ...(groupId ? { groupId } : {}) });
    }
  }
  return sources;
}

function hasOperatorInsight(message: ConversationMessage): boolean {
  return getOperatorAiReasoning(message) !== null || getOperatorAiSources(message).length > 0;
}

/** Show once per agent run: last consecutive AI bubble that shares the same `agent_run_id`. */
export function shouldShowOperatorAiReasoningFooter(
  message: ConversationMessage,
  nextMessage: ConversationMessage | null,
): boolean {
  if (message.outgoing_sender_type !== "ai_agent") return false;
  if (!hasOperatorInsight(message)) return false;
  const runId = getAgentRunId(message);
  const next = nextMessage;
  if (!next || next.outgoing_sender_type !== "ai_agent") return true;
  const nextRunId = getAgentRunId(next);
  if (runId && nextRunId && runId === nextRunId) return false;
  return true;
}

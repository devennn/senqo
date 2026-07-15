/** Mirrors backend agent-run-log kinds for Agent Logs UI badges. */
export const AGENT_RUN_LOG_SOURCE = "agent_run_log";
export const AGENT_RUN_LOG_KIND_LLM_OUTPUT = "llm_structured_output";
export const AGENT_RUN_LOG_KIND_WHATSAPP_SENT = "whatsapp_outbound";

export function agentRunLogKind(
  providerOptions: Record<string, unknown> | null | undefined,
): string | null {
  if (!providerOptions || providerOptions.source !== AGENT_RUN_LOG_SOURCE) {
    return null;
  }
  const kind = providerOptions.kind;
  return typeof kind === "string" ? kind : null;
}

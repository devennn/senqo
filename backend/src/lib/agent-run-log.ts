/** provider_options.source for transcript rows that are UI/ops logs, not model history. */
export const AGENT_RUN_LOG_SOURCE = "agent_run_log";

export const AGENT_RUN_LOG_KIND_LLM_OUTPUT = "llm_structured_output";
export const AGENT_RUN_LOG_KIND_WHATSAPP_SENT = "whatsapp_outbound";
/** Verbose failure detail for a run that produced no reply (shown in Agent Logs only). */
export const AGENT_RUN_LOG_KIND_AGENT_ERROR = "agent_error";
/** Provider rejected replayable history; the run retried once without volatile parts. */
export const AGENT_RUN_LOG_KIND_HISTORY_RETRY = "history_retry";

export function isAgentRunLogProviderOptions(
  providerOptions: Record<string, unknown> | null | undefined,
): boolean {
  return providerOptions?.source === AGENT_RUN_LOG_SOURCE;
}

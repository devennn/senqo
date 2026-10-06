export const THREAD_EVENT_HANDOFF_TO_HUMAN = "handoff_to_human";
export const THREAD_EVENT_MANUAL_TOGGLE = "manual_toggle_human";
export const THREAD_EVENT_AGENT_ERROR = "agent_error";

export type ConversationThreadEventType =
  | typeof THREAD_EVENT_HANDOFF_TO_HUMAN
  | typeof THREAD_EVENT_MANUAL_TOGGLE
  | typeof THREAD_EVENT_AGENT_ERROR;

export function asConversationThreadEventType(
  value: unknown,
): ConversationThreadEventType | null {
  if (value === THREAD_EVENT_HANDOFF_TO_HUMAN) return THREAD_EVENT_HANDOFF_TO_HUMAN;
  if (value === THREAD_EVENT_MANUAL_TOGGLE) return THREAD_EVENT_MANUAL_TOGGLE;
  if (value === THREAD_EVENT_AGENT_ERROR) return THREAD_EVENT_AGENT_ERROR;
  return null;
}

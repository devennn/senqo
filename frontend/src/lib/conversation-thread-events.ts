export const THREAD_EVENT_HANDOFF_TO_HUMAN = "handoff_to_human";
export const THREAD_EVENT_MANUAL_TOGGLE = "manual_toggle_human";

export type ConversationThreadEventType =
  | typeof THREAD_EVENT_HANDOFF_TO_HUMAN
  | typeof THREAD_EVENT_MANUAL_TOGGLE;

export function asConversationThreadEventType(
  value: unknown,
): ConversationThreadEventType | null {
  if (value === THREAD_EVENT_HANDOFF_TO_HUMAN) return THREAD_EVENT_HANDOFF_TO_HUMAN;
  if (value === THREAD_EVENT_MANUAL_TOGGLE) return THREAD_EVENT_MANUAL_TOGGLE;
  return null;
}

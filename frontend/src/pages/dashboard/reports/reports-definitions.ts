// Shared metric/column definitions for the Reports UI. Used by the summary
// cards and the "i" hints on table column headers so the wording stays
// consistent across the page.

export const REPORTS_DEFINITIONS = {
  totalConversations:
    "All conversations with at least one message between the selected dates — from customers, the agent, or your team.",
  conversationsHandled:
    "Conversations where the agent sent at least one AI reply in the selected date range.",
  totalMessages:
    "Every message exchanged between the selected dates: incoming customer messages plus agent and human replies.",
  aiReplies:
    "Individual messages sent by the agent — text and media bubbles combined.",
  handoffs:
    "Times the agent escalated a conversation to a human, based on the escalation reason it selected.",
  handoffRate:
    "Share of agent-handled conversations that escalated to a human: handoffs ÷ conversations handled.",
  inHumanMode:
    "Conversations currently switched to human handling and not archived. A live snapshot — it ignores the selected date range.",
  technicalErrors:
    "Outbound messages that failed to send after retries (e.g. connection or delivery problems). Nothing was delivered for these messages.",
  reportedErrors:
    "Conversations your team reported as wrong from the chats list or an open conversation, counted on the date the report was submitted.",
  topicShare:
    "Share of all handoffs in the selected date range attributed to this topic.",
  reportedOn:
    "The date each conversation was reported as wrong, taken from the report submission.",
} as const;

export type ReportsDefinitionKey = keyof typeof REPORTS_DEFINITIONS;

/** Sentence-case accessible name for a column/metric info control. */
export function hintLabel(label: string): string {
  const first = label.charAt(0);
  const second = label.charAt(1);
  // Keep acronyms (e.g. "AI replies") untouched; lower-case normal words.
  const isFirstAcronym = /[A-Z]/.test(first) && /[A-Z]/.test(second);
  const sentenceFirst = isFirstAcronym ? first : first.toLowerCase();
  return `About ${sentenceFirst}${label.slice(1)}`;
}
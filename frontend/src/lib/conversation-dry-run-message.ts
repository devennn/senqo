import type { ConversationMessage } from "@/types/repositories";

function messageMetadata(message: ConversationMessage): Record<string, unknown> | null {
  return message.metadata && typeof message.metadata === "object"
    ? (message.metadata as Record<string, unknown>)
    : null;
}

/** AI reply drafted while the line is in Dry run mode; visible in the thread but never sent. */
export function isDryRunDraftMessage(message: ConversationMessage): boolean {
  if (message.outgoing_sender_type !== "ai_agent") return false;
  return messageMetadata(message)?.dry_run === true;
}

/** Operator-only thread events (would-hand-off, AI error) recorded during a Dry run. */
export function isDryRunThreadEventMessage(message: ConversationMessage): boolean {
  return messageMetadata(message)?.dry_run === true;
}

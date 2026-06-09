import { getGroupParticipantStableKey } from "@/lib/group-participant-color";
import type { ConversationMessage } from "@/types/repositories";

/** Stable key for clustering consecutive bubbles from the same logical sender. */
export function getMessageClusterSenderKey(message: ConversationMessage): string {
  if (message.outgoing_sender_type === "ai_agent") return "out:ai";
  if (message.role !== "user") return "out:human";
  const groupParticipant = getGroupParticipantStableKey(message);
  if (groupParticipant !== null) return `in:group:${groupParticipant}`;
  return "in:direct";
}

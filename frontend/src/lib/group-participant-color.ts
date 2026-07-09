/** WhatsApp-style accent colors for group participants (incoming user messages). */

import type { ConversationMessage } from "@/types/repositories";

const PALETTE = [
  {
    labelClass: "text-teal-700 dark:text-teal-300",
    avatarWrapClass: "bg-teal-500/15 dark:bg-teal-500/25",
    avatarIconClass: "text-teal-700 dark:text-teal-300",
    bubbleAccentClass: "border-l-[3px] border-teal-500/65 dark:border-teal-400/70",
  },
  {
    labelClass: "text-orange-700 dark:text-orange-300",
    avatarWrapClass: "bg-orange-500/15 dark:bg-orange-500/25",
    avatarIconClass: "text-orange-700 dark:text-orange-300",
    bubbleAccentClass: "border-l-[3px] border-orange-500/65 dark:border-orange-400/70",
  },
  {
    labelClass: "text-violet-700 dark:text-violet-300",
    avatarWrapClass: "bg-violet-500/15 dark:bg-violet-500/25",
    avatarIconClass: "text-violet-700 dark:text-violet-300",
    bubbleAccentClass: "border-l-[3px] border-violet-500/65 dark:border-violet-400/70",
  },
  {
    labelClass: "text-rose-700 dark:text-rose-300",
    avatarWrapClass: "bg-rose-500/15 dark:bg-rose-500/25",
    avatarIconClass: "text-rose-700 dark:text-rose-300",
    bubbleAccentClass: "border-l-[3px] border-rose-500/65 dark:border-rose-400/70",
  },
  {
    labelClass: "text-sky-700 dark:text-sky-300",
    avatarWrapClass: "bg-sky-500/15 dark:bg-sky-500/25",
    avatarIconClass: "text-sky-700 dark:text-sky-300",
    bubbleAccentClass: "border-l-[3px] border-sky-500/65 dark:border-sky-400/70",
  },
  {
    labelClass: "text-amber-700 dark:text-amber-300",
    avatarWrapClass: "bg-amber-500/15 dark:bg-amber-500/25",
    avatarIconClass: "text-amber-700 dark:text-amber-300",
    bubbleAccentClass: "border-l-[3px] border-amber-500/65 dark:border-amber-400/70",
  },
  {
    labelClass: "text-indigo-700 dark:text-indigo-300",
    avatarWrapClass: "bg-indigo-500/15 dark:bg-indigo-500/25",
    avatarIconClass: "text-indigo-700 dark:text-indigo-300",
    bubbleAccentClass: "border-l-[3px] border-indigo-500/65 dark:border-indigo-400/70",
  },
  {
    labelClass: "text-fuchsia-700 dark:text-fuchsia-300",
    avatarWrapClass: "bg-fuchsia-500/15 dark:bg-fuchsia-500/25",
    avatarIconClass: "text-fuchsia-700 dark:text-fuchsia-300",
    bubbleAccentClass: "border-l-[3px] border-fuchsia-500/65 dark:border-fuchsia-400/70",
  },
  {
    labelClass: "text-cyan-700 dark:text-cyan-300",
    avatarWrapClass: "bg-cyan-500/15 dark:bg-cyan-500/25",
    avatarIconClass: "text-cyan-700 dark:text-cyan-300",
    bubbleAccentClass: "border-l-[3px] border-cyan-500/65 dark:border-cyan-400/70",
  },
  {
    labelClass: "text-blue-700 dark:text-blue-300",
    avatarWrapClass: "bg-blue-500/15 dark:bg-blue-500/25",
    avatarIconClass: "text-blue-700 dark:text-blue-300",
    bubbleAccentClass: "border-l-[3px] border-blue-500/65 dark:border-blue-400/70",
  },
  {
    labelClass: "text-pink-700 dark:text-pink-300",
    avatarWrapClass: "bg-pink-500/15 dark:bg-pink-500/25",
    avatarIconClass: "text-pink-700 dark:text-pink-300",
    bubbleAccentClass: "border-l-[3px] border-pink-500/65 dark:border-pink-400/70",
  },
  {
    labelClass: "text-lime-700 dark:text-lime-300",
    avatarWrapClass: "bg-lime-500/15 dark:bg-lime-500/25",
    avatarIconClass: "text-lime-800 dark:text-lime-300",
    bubbleAccentClass: "border-l-[3px] border-lime-600/65 dark:border-lime-400/70",
  },
] as const;

export const GROUP_PARTICIPANT_COLOR_SLOT_COUNT = PALETTE.length;

function labelFromWhatsappId(chatId: string | null): string | null {
  const id = chatId?.split("@")[0]?.trim();
  return id || null;
}

/** Stable identity for incoming group messages; same sender → same key when IDs/names match. */
export function getGroupParticipantStableKey(message: ConversationMessage): string | null {
  if (message.role !== "user") return null;
  const metadata = message.metadata as Record<string, unknown> | null;
  if (metadata?.isGroupChat !== true) return null;
  const senderLabel =
    message.whatsapp_sender_name ||
    labelFromWhatsappId(message.whatsapp_sender_chat_id) ||
    "Group participant";
  return (
    message.whatsapp_sender_chat_id?.trim() ||
    message.whatsapp_sender_name?.trim() ||
    senderLabel.trim() ||
    message.id
  );
}

/**
 * Assigns 0..n-1 to each distinct participant in message order (first appearance).
 * Guarantees unique colors among participants until count exceeds {@link GROUP_PARTICIPANT_COLOR_SLOT_COUNT}.
 */
export function buildGroupParticipantColorOrderMap(messages: ConversationMessage[]): Map<string, number> {
  const map = new Map<string, number>();
  let order = 0;
  for (const m of messages) {
    const key = getGroupParticipantStableKey(m);
    if (key === null) continue;
    if (!map.has(key)) {
      map.set(key, order);
      order++;
    }
  }
  return map;
}

export function getGroupParticipantColorClassesByParticipantOrder(participantOrderIndex: number): {
  labelClass: string;
  avatarWrapClass: string;
  avatarIconClass: string;
  bubbleAccentClass: string;
} {
  return PALETTE[participantOrderIndex % PALETTE.length];
}

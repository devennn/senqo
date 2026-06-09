import { format, isSameDay, isThisWeek, isToday, isYesterday } from "date-fns";

/** Time only for a single message bubble (no seconds). */
export function formatConversationMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "p");
}

/** Date label for WhatsApp-style day dividers in the thread. */
export function formatConversationMessageDateGroup(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, "EEEE");
  return format(d, "d MMM yyyy");
}

export function isSameConversationMessageDay(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return isSameDay(a, b);
}

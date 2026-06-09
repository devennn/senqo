import { format, isThisWeek, isToday, isYesterday } from "date-fns";

export function formatConversationListTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "p");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d, { weekStartsOn: 1 })) return format(d, "EEE");
  return format(d, "dd/MM/yy");
}

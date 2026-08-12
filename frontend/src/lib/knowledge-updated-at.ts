import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";

/** Groups older than this many days show an “may be outdated” hint. */
export const KNOWLEDGE_STALE_AFTER_DAYS = 90;

export function parseKnowledgeUpdatedAt(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isKnowledgeStale(iso: string, now = new Date()): boolean {
  const d = parseKnowledgeUpdatedAt(iso);
  if (!d) return false;
  return differenceInCalendarDays(now, d) >= KNOWLEDGE_STALE_AFTER_DAYS;
}

/** Short label for list rows; full date available via `formatKnowledgeUpdatedAtTitle`. */
export function formatKnowledgeUpdatedAt(iso: string, now = new Date()): string {
  const d = parseKnowledgeUpdatedAt(iso);
  if (!d) return "";
  if (isToday(d)) return `Updated today · ${format(d, "p")}`;
  if (isYesterday(d)) return "Updated yesterday";
  const days = differenceInCalendarDays(now, d);
  if (days > 0 && days < 7) return `Updated ${days}d ago`;
  return `Updated ${format(d, "dd MMM yyyy")}`;
}

export function formatKnowledgeUpdatedAtTitle(iso: string): string {
  const d = parseKnowledgeUpdatedAt(iso);
  if (!d) return "";
  return format(d, "d MMM yyyy, p");
}

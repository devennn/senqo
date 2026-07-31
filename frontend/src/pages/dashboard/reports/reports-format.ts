import { format, subDays } from "date-fns";
import type { ReportsDateRange } from "@/types/reports";

/** UI page size for the agents performance table. */
export const REPORTS_AGENTS_PAGE_SIZE = 7;

/** UI page size for the handoff topics table. */
export const REPORTS_TOPICS_PAGE_SIZE = 7;

/** Default report window: today and the previous 29 days (30 calendar days). */
export function defaultReportsDateRange(now = new Date()): ReportsDateRange {
  return {
    from: format(subDays(now, 29), "yyyy-MM-dd"),
    to: format(now, "yyyy-MM-dd"),
  };
}

export function handoffRatePercent(conversations: number, handoffs: number): number {
  if (conversations <= 0) return 0;
  return Math.round((handoffs / conversations) * 1000) / 10;
}

export function formatHandoffRate(conversations: number, handoffs: number): string {
  return `${handoffRatePercent(conversations, handoffs)}%`;
}

export function topicSharePercent(topicHandoffs: number, totalHandoffs: number): number {
  if (totalHandoffs <= 0) return 0;
  return Math.round((topicHandoffs / totalHandoffs) * 1000) / 10;
}

export function formatTopicShare(topicHandoffs: number, totalHandoffs: number): string {
  return `${topicSharePercent(topicHandoffs, totalHandoffs)}%`;
}

import { describe, expect, it } from "vitest";
import {
  formatKnowledgeUpdatedAt,
  formatKnowledgeUpdatedAtTitle,
  isKnowledgeStale,
  KNOWLEDGE_STALE_AFTER_DAYS,
} from "@/lib/knowledge-updated-at";

describe("knowledge-updated-at", () => {
  // Today’s ISO should read as “Updated today” so list rows stay scannable.
  it("formatKnowledgeUpdatedAt → labels today under current day", () => {
    const now = new Date();
    expect(formatKnowledgeUpdatedAt(now.toISOString(), now)).toMatch(/^Updated today/);
  });

  // Stale threshold gates the outdated hint on Knowledge list rows.
  it("isKnowledgeStale → true when at or past KNOWLEDGE_STALE_AFTER_DAYS", () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const staleIso = new Date(now);
    staleIso.setUTCDate(staleIso.getUTCDate() - KNOWLEDGE_STALE_AFTER_DAYS);
    expect(isKnowledgeStale(staleIso.toISOString(), now)).toBe(true);
    const freshIso = new Date(now);
    freshIso.setUTCDate(freshIso.getUTCDate() - (KNOWLEDGE_STALE_AFTER_DAYS - 1));
    expect(isKnowledgeStale(freshIso.toISOString(), now)).toBe(false);
  });

  // Title attribute shows absolute time for hover/accessibility.
  it("formatKnowledgeUpdatedAtTitle → absolute date-time string", () => {
    const title = formatKnowledgeUpdatedAtTitle("2026-01-15T10:00:00.000Z");
    expect(title.length).toBeGreaterThan(0);
    expect(title).toMatch(/2026|Jan|15/);
  });
});

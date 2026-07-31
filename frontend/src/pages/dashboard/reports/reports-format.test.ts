import { describe, it, expect } from "vitest";
import {
  defaultReportsDateRange,
  formatHandoffRate,
  formatTopicShare,
  handoffRatePercent,
  topicSharePercent,
} from "@/pages/dashboard/reports/reports-format";

describe("reports-format helpers", () => {
  // Rate helper divides handoffs by conversations — verifies the percent shown in the UI.
  it("handoffRatePercent → returns percentage under normal counts", () => {
    expect(handoffRatePercent(100, 12)).toBe(12);
    expect(formatHandoffRate(100, 12)).toBe("12%");
  });

  // Zero conversations must not divide by zero — verifies empty agents show 0%.
  it("handoffRatePercent → returns 0 when conversations are 0", () => {
    expect(handoffRatePercent(0, 5)).toBe(0);
  });

  // Default range is inclusive 30 calendar days ending today.
  it("defaultReportsDateRange → spans 30 days ending on now", () => {
    const range = defaultReportsDateRange(new Date("2026-07-31T12:00:00Z"));
    expect(range).toEqual({ from: "2026-07-02", to: "2026-07-31" });
  });

  // Topic share uses total handoffs as denominator — verifies share column math.
  it("topicSharePercent → returns share of total handoffs", () => {
    expect(topicSharePercent(25, 100)).toBe(25);
    expect(formatTopicShare(25, 100)).toBe("25%");
  });
});

import { describe, it, expect } from "vitest";
import {
  formatZonedDateTimeFromIso,
  formatZonedDateTimeWithZone,
  isValidTimeZone,
} from "./timezone.js";

describe("isValidTimeZone", () => {
  // Real IANA zones must pass so workspace settings accept them.
  it("accepts an IANA zone", () => {
    expect(isValidTimeZone("Asia/Kuala_Lumpur")).toBe(true);
  });

  // Unknown zones must be rejected before persistence.
  it("rejects an unknown zone", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  // Blank input is not a timezone.
  it("rejects blank input", () => {
    expect(isValidTimeZone("   ")).toBe(false);
  });
});

describe("formatZonedDateTimeWithZone", () => {
  // Business-local clock label includes weekday, date, time, zone, and offset so the
  // model never converts UTC itself.
  it("renders date, time, zone, and offset", () => {
    expect(
      formatZonedDateTimeWithZone(new Date("2026-09-25T05:15:00.000Z"), "Asia/Kuala_Lumpur"),
    ).toBe("Friday, September 25, 2026 at 1:15 PM (Asia/Kuala_Lumpur, GMT+8)");
  });
});

describe("formatZonedDateTimeFromIso", () => {
  // Unparseable timestamps must be dropped rather than throwing into the agent run.
  it("returns null for an unparseable timestamp", () => {
    expect(formatZonedDateTimeFromIso("not-a-date", "UTC")).toBe(null);
  });

  // UTC fallback remains explicit for workspaces that have not changed the setting.
  it("renders UTC input with the UTC zone label", () => {
    expect(formatZonedDateTimeFromIso("2026-09-25T05:15:00.000Z", "UTC")).toBe(
      "Friday, September 25, 2026 at 5:15 AM (UTC, GMT+0)",
    );
  });
});

import { describe, it, expect } from "vitest";
import { isScheduleDueThisMinute } from "./eval-schedule-due.js";

const MYT = "Asia/Kuala_Lumpur";

describe("isScheduleDueThisMinute", () => {
  // Daily cadence at 20:00 Malaysia Time → due when UTC is that local minute.
  it("daily → due this minute when local hour and minute match", () => {
    const now = new Date("2026-08-09T12:00:10.000Z");
    expect(
      isScheduleDueThisMinute(
        {
          repeat: "daily",
          weekdays: [],
          monthDay: null,
          hour: 20,
          minute: 0,
          timezone: MYT,
          lastFiredAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  // Same local slot already recorded on last_fired_at → skip so the tick does not double-fire.
  it("daily → not due when lastFiredAt is already this slot", () => {
    const now = new Date("2026-08-09T12:00:40.000Z");
    expect(
      isScheduleDueThisMinute(
        {
          repeat: "daily",
          weekdays: [],
          monthDay: null,
          hour: 20,
          minute: 0,
          timezone: MYT,
          lastFiredAt: new Date("2026-08-09T12:00:05.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  // Weekly Mon+Wed → fires on Wednesday 20:00 MYT, needed for multi-day chips.
  it("weekly → due on a selected weekday", () => {
    const wednesday = new Date("2026-08-12T12:00:00.000Z");
    expect(
      isScheduleDueThisMinute(
        {
          repeat: "weekly",
          weekdays: [1, 3],
          monthDay: null,
          hour: 20,
          minute: 0,
          timezone: MYT,
          lastFiredAt: null,
        },
        wednesday,
      ),
    ).toBe(true);
  });

  // Weekly Mon+Wed → skip Tuesday, needed so unselected days do not run.
  it("weekly → not due on an unselected weekday", () => {
    const tuesday = new Date("2026-08-11T12:00:00.000Z");
    expect(
      isScheduleDueThisMinute(
        {
          repeat: "weekly",
          weekdays: [1, 3],
          monthDay: null,
          hour: 20,
          minute: 0,
          timezone: MYT,
          lastFiredAt: null,
        },
        tuesday,
      ),
    ).toBe(false);
  });

  // Monthly day 15 → due on the 15th at the scheduled time.
  it("monthly → due when local day-of-month matches", () => {
    const fifteenth = new Date("2026-08-15T12:00:00.000Z");
    expect(
      isScheduleDueThisMinute(
        {
          repeat: "monthly",
          weekdays: [],
          monthDay: 15,
          hour: 20,
          minute: 0,
          timezone: MYT,
          lastFiredAt: null,
        },
        fifteenth,
      ),
    ).toBe(true);
  });
});

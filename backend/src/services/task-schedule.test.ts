import { describe, it, expect } from "vitest";
import { taskScheduleSchema, toCronSchedule } from "../services/task-schedule.js";

describe("taskScheduleSchema", () => {
  it("validates a valid one-time schedule", () => {
    const result = taskScheduleSchema.safeParse({
      scheduleType: "one_time",
      oneTimeAt: "2025-12-25T10:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing oneTimeAt", () => {
    const result = taskScheduleSchema.safeParse({
      scheduleType: "one_time",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["oneTimeAt"]);
    }
  });

  it("rejects scheduleType other than 'one_time'", () => {
    const result = taskScheduleSchema.safeParse({
      scheduleType: "recurring",
      oneTimeAt: "2025-12-25T10:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("toCronSchedule", () => {
  it("returns cronExpression null and converts local datetime to ISO string", () => {
    const result = toCronSchedule({
      scheduleType: "one_time",
      oneTimeAt: "2025-06-15T14:30",
    });
    expect(result.cronExpression).toBeNull();
    expect(result.oneTimeAt).toBe("2025-06-15T14:30:00.000Z");
    expect(result.timezone).toBe("UTC");
  });

  it("handles Z-suffixed UTC ISO string correctly", () => {
    const result = toCronSchedule({
      scheduleType: "one_time",
      oneTimeAt: "2025-12-25T10:00:00Z",
    });
    expect(result.cronExpression).toBeNull();
    expect(result.oneTimeAt).toBe("2025-12-25T10:00:00.000Z");
    expect(result.timezone).toBe("UTC");
  });

  it("throws 'invalid_one_time_date' on invalid date input", () => {
    expect(() =>
      toCronSchedule({
        scheduleType: "one_time",
        oneTimeAt: "not-a-date",
      }),
    ).toThrow("invalid_one_time_date");
  });
});

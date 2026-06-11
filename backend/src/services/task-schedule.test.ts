import { describe, it, expect } from "vitest";
import { taskScheduleSchema, toCronSchedule } from "../services/task-schedule.js";

describe("taskScheduleSchema", () => {
  // scheduleType is "one_time" and oneTimeAt is a valid datetime → schema validates successfully, needed to ensure the happy-path input shape is accepted.
  it("validates a valid one-time schedule", () => {
    const result = taskScheduleSchema.safeParse({
      scheduleType: "one_time",
      oneTimeAt: "2025-12-25T10:00",
    });
    expect(result.success).toBe(true);
  });

  // scheduleType is "one_time" but oneTimeAt is missing → schema rejects with error on oneTimeAt path, needed to enforce the required field.
  it("rejects missing oneTimeAt", () => {
    const result = taskScheduleSchema.safeParse({
      scheduleType: "one_time",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["oneTimeAt"]);
    }
  });

  // scheduleType is "recurring" which is not in the enum → schema rejects, needed because the schema currently only allows "one_time".
  it("rejects scheduleType other than 'one_time'", () => {
    const result = taskScheduleSchema.safeParse({
      scheduleType: "recurring",
      oneTimeAt: "2025-12-25T10:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("toCronSchedule", () => {
  // A valid local datetime string is provided → cronExpression is null and oneTimeAt is converted to UTC ISO with milliseconds, needed to verify the date conversion and default timezone assignment.
  it("returns cronExpression null and converts local datetime to ISO string", () => {
    const result = toCronSchedule({
      scheduleType: "one_time",
      oneTimeAt: "2025-06-15T14:30",
    });
    expect(result.cronExpression).toBeNull();
    expect(result.oneTimeAt).toBe("2025-06-15T14:30:00.000Z");
    expect(result.timezone).toBe("UTC");
  });

  // Input already has a Z suffix (UTC) → it is preserved and formatted with milliseconds, needed to confirm pre-formatted UTC strings work correctly.
  it("handles Z-suffixed UTC ISO string correctly", () => {
    const result = toCronSchedule({
      scheduleType: "one_time",
      oneTimeAt: "2025-12-25T10:00:00Z",
    });
    expect(result.cronExpression).toBeNull();
    expect(result.oneTimeAt).toBe("2025-12-25T10:00:00.000Z");
    expect(result.timezone).toBe("UTC");
  });

  // The oneTimeAt string is not parseable as a date → throws "invalid_one_time_date", needed to catch garbage input before it reaches scheduling.
  it("throws 'invalid_one_time_date' on invalid date input", () => {
    expect(() =>
      toCronSchedule({
        scheduleType: "one_time",
        oneTimeAt: "not-a-date",
      }),
    ).toThrow("invalid_one_time_date");
  });
});

import { z } from "zod";

export const taskScheduleSchema = z
  .object({
    scheduleType: z.literal("one_time"),
    oneTimeAt: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.oneTimeAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "One-time datetime is required", path: ["oneTimeAt"] });
    }
  });

export function toCronSchedule(input: z.infer<typeof taskScheduleSchema>): {
  cronExpression: string | null;
  oneTimeAt: string | null;
  timezone: "UTC";
} {
  const rawOneTimeAt = input.oneTimeAt ?? "";
  // Dashboard sends full ISO UTC (`…Z`) after browser conversion. Naive `YYYY-MM-DDTHH:mm` is treated as UTC wall clock (for API/AI callers).
  const hasTimezoneSuffix = /(?:Z|[+-]\d{2}:\d{2})$/.test(rawOneTimeAt);
  const parsedDate = new Date(hasTimezoneSuffix ? rawOneTimeAt : `${rawOneTimeAt}Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("invalid_one_time_date");
  }
  return {
    cronExpression: null,
    oneTimeAt: parsedDate.toISOString(),
    timezone: "UTC",
  };
}

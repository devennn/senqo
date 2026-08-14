import type { EvalSchedule, EvalScheduleWeekday } from "@/types/evals";

export const EVAL_SCHEDULE_WEEKDAYS: Array<{
  value: EvalScheduleWeekday;
  label: string;
  short: string;
}> = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

function formatClock(time: string): string {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTimezone(timezone: string): string {
  try {
    const name = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: "long",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return name ?? timezone.replaceAll("_", " ");
  } catch {
    return timezone.replaceAll("_", " ");
  }
}

function joinDays(weekdays: EvalScheduleWeekday[]): string {
  const labels = EVAL_SCHEDULE_WEEKDAYS.filter((day) => weekdays.includes(day.value)).map(
    (day) => day.label,
  );
  if (labels.length === 0) return "selected days";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function weekdayPhrase(weekdays: EvalScheduleWeekday[]): string {
  const set = new Set(weekdays);
  if (set.size === 7) return "day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day as EvalScheduleWeekday))) {
    return "weekday";
  }
  if (set.size === 2 && set.has(0) && set.has(6)) return "weekend";
  return joinDays(weekdays);
}

function ordinal(day: number): string {
  const teens = day % 100;
  if (teens >= 11 && teens <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

export function formatEvalScheduleSummary(schedule: EvalSchedule): string {
  const clock = formatClock(schedule.time);
  const zone = formatTimezone(schedule.timezone);
  if (schedule.repeat === "daily") return `Every day at ${clock} (${zone})`;
  if (schedule.repeat === "monthly") {
    return `On the ${ordinal(schedule.monthDay)} of each month at ${clock} (${zone})`;
  }
  return `Every ${weekdayPhrase(schedule.weekdays)} at ${clock} (${zone})`;
}

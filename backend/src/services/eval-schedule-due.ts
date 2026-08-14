import { fromZonedTime } from "date-fns-tz";

export type EvalScheduleDueInput = {
  repeat: "daily" | "weekly" | "monthly";
  weekdays: number[];
  monthDay: number | null;
  hour: number;
  minute: number;
  timezone: string;
  lastFiredAt: Date | null;
};

export type ZonedClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedClock(now: Date, timeZone: string): ZonedClock | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const weekday = WEEKDAY_INDEX[map.weekday ?? ""];
    const year = Number(map.year);
    const month = Number(map.month);
    const day = Number(map.day);
    const hour = Number(map.hour);
    const minute = Number(map.minute);
    if (
      weekday === undefined ||
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      return null;
    }
    return { year, month, day, hour, minute, weekday };
  } catch {
    return null;
  }
}

export function scheduleSlotKey(clock: ZonedClock): string {
  const month = String(clock.month).padStart(2, "0");
  const day = String(clock.day).padStart(2, "0");
  const hour = String(clock.hour).padStart(2, "0");
  const minute = String(clock.minute).padStart(2, "0");
  return `${clock.year}-${month}-${day}T${hour}:${minute}`;
}

export function scheduleSlotStartUtc(clock: ZonedClock, timeZone: string): Date | null {
  try {
    return fromZonedTime(`${scheduleSlotKey(clock)}:00`, timeZone);
  } catch {
    return null;
  }
}

export function isScheduleDueThisMinute(
  schedule: EvalScheduleDueInput,
  now: Date,
): boolean {
  const clock = zonedClock(now, schedule.timezone);
  if (!clock) return false;
  if (clock.hour !== schedule.hour || clock.minute !== schedule.minute) return false;
  if (schedule.lastFiredAt) {
    const lastClock = zonedClock(schedule.lastFiredAt, schedule.timezone);
    if (lastClock && scheduleSlotKey(lastClock) === scheduleSlotKey(clock)) return false;
  }
  if (schedule.repeat === "daily") return true;
  if (schedule.repeat === "weekly") return schedule.weekdays.includes(clock.weekday);
  if (schedule.repeat === "monthly") return clock.day === schedule.monthDay;
  return false;
}

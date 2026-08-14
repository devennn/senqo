import {
  claimEvalScheduleSlot,
  listAllEvalSchedules,
} from "../repositories/eval-schedules.js";
import {
  isScheduleDueThisMinute,
  scheduleSlotStartUtc,
  zonedClock,
} from "./eval-schedule-due.js";

const scope = "EvalScheduleTick";

export type EvalScheduleRunPayload = {
  workspaceId: string;
  evalCaseId: string;
  scheduleId: string;
};

export async function tickEvalSchedules(now = new Date()): Promise<EvalScheduleRunPayload[]> {
  const due: EvalScheduleRunPayload[] = [];
  const schedules = await listAllEvalSchedules();
  for (const schedule of schedules) {
    if (!schedule.enabled) continue;
    const dueInput = {
      repeat: schedule.repeat,
      weekdays: schedule.weekdays,
      monthDay: schedule.monthDay,
      hour: schedule.hour,
      minute: schedule.minute,
      timezone: schedule.timezone,
      lastFiredAt: schedule.lastFiredAt ? new Date(schedule.lastFiredAt) : null,
    };
    if (!isScheduleDueThisMinute(dueInput, now)) continue;

    const clock = zonedClock(now, schedule.timezone);
    const slotStart = clock ? scheduleSlotStartUtc(clock, schedule.timezone) : null;
    if (!slotStart) continue;

    const claimed = await claimEvalScheduleSlot(schedule.id, slotStart, now);
    if (!claimed.ok) continue;

    due.push({
      workspaceId: schedule.workspaceId,
      evalCaseId: schedule.evalCaseId,
      scheduleId: schedule.id,
    });
    console.info(`[${scope}/tickEvalSchedules] Success: scheduleId=${schedule.id}`);
  }
  return due;
}

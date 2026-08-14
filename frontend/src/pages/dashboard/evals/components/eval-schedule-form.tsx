import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EVAL_SCHEDULE_WEEKDAYS,
  formatEvalScheduleSummary,
} from "@/pages/dashboard/evals/components/eval-schedule-label";
import type {
  EvalSchedule,
  EvalScheduleMember,
  EvalScheduleRepeat,
  EvalScheduleWeekday,
} from "@/types/evals";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-9 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-2 focus-visible:border-ring";

type Props = {
  draft: EvalSchedule;
  members: EvalScheduleMember[];
  onChange: (next: EvalSchedule) => void;
};

function toggleWeekday(
  weekdays: EvalScheduleWeekday[],
  day: EvalScheduleWeekday,
): EvalScheduleWeekday[] {
  if (weekdays.includes(day)) return weekdays.filter((item) => item !== day);
  return [...weekdays, day].sort((a, b) => a - b);
}

export function EvalScheduleForm({ draft, members, onChange }: Props) {
  return (
    <div className="grid gap-4">
      <p className="rounded-md bg-secondary px-3 py-2.5 text-sm font-medium text-foreground dark:bg-muted">
        {formatEvalScheduleSummary(draft)}
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="eval-schedule-repeat">Repeat</Label>
        <select
          id="eval-schedule-repeat"
          className={selectClassName}
          value={draft.repeat}
          onChange={(event) =>
            onChange({ ...draft, repeat: event.target.value as EvalScheduleRepeat })
          }
        >
          <option value="daily">Every day</option>
          <option value="weekly">Every week</option>
          <option value="monthly">Every month</option>
        </select>
      </div>
      {draft.repeat === "weekly" ? (
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">On</p>
          <div className="flex flex-wrap gap-1.5">
            {EVAL_SCHEDULE_WEEKDAYS.map((day) => {
              const selected = draft.weekdays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={day.label}
                  onClick={() => onChange({ ...draft, weekdays: toggleWeekday(draft.weekdays, day.value) })}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-primary dark:bg-muted dark:text-foreground",
                  )}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {draft.repeat === "monthly" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="eval-schedule-month-day">On day</Label>
          <select
            id="eval-schedule-month-day"
            className={selectClassName}
            value={draft.monthDay}
            onChange={(event) => onChange({ ...draft, monthDay: Number(event.target.value) })}
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="eval-schedule-time">At</Label>
        <Input
          id="eval-schedule-time"
          type="time"
          className="h-9 text-sm"
          value={draft.time}
          onChange={(event) => onChange({ ...draft, time: event.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="eval-schedule-notify">Email on fail or error</Label>
        <select
          id="eval-schedule-notify"
          className={selectClassName}
          value={draft.notifyUserId}
          onChange={(event) => onChange({ ...draft, notifyUserId: event.target.value })}
        >
          <option value="">Select a member</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.email}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

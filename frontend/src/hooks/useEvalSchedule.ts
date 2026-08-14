import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { useTransientBooleanReset } from "@/hooks/useTransientBooleanReset";
import type { TeamMemberRecord } from "@/types/repositories";
import type { EvalSchedule, EvalScheduleMember, EvalScheduledRun } from "@/types/evals";

export const EVAL_SUITE_RUN_PAGE_SIZE = 5;

type ScheduleApi = {
  repeat: EvalSchedule["repeat"];
  weekdays: EvalSchedule["weekdays"];
  monthDay: number | null;
  hour: number;
  minute: number;
  timezone: string;
  notifyUserId: string | null;
  enabled: boolean;
};

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultSchedule(): EvalSchedule {
  return {
    repeat: "weekly",
    weekdays: [0],
    monthDay: 1,
    time: "20:00",
    timezone: browserTimeZone(),
    notifyUserId: "",
  };
}

function fromApi(row: ScheduleApi): EvalSchedule {
  return {
    repeat: row.repeat,
    weekdays: row.weekdays,
    monthDay: row.monthDay ?? 1,
    time: `${pad(row.hour)}:${pad(row.minute)}`,
    timezone: row.timezone,
    notifyUserId: row.notifyUserId ?? "",
  };
}

function toApi(schedule: EvalSchedule): Omit<ScheduleApi, "enabled"> {
  const [hourRaw, minuteRaw] = schedule.time.split(":");
  return {
    repeat: schedule.repeat,
    weekdays: schedule.weekdays,
    monthDay: schedule.repeat === "monthly" ? schedule.monthDay : null,
    hour: Number(hourRaw),
    minute: Number(minuteRaw),
    timezone: browserTimeZone(),
    notifyUserId: schedule.notifyUserId,
  };
}

function weekdayKey(weekdays: EvalSchedule["weekdays"]): string {
  return [...weekdays].sort((a, b) => a - b).join(",");
}

function schedulesEqual(a: EvalSchedule, b: EvalSchedule): boolean {
  return (
    a.repeat === b.repeat &&
    weekdayKey(a.weekdays) === weekdayKey(b.weekdays) &&
    a.monthDay === b.monthDay &&
    a.time === b.time &&
    a.notifyUserId === b.notifyUserId
  );
}

function isScheduleValid(schedule: EvalSchedule): boolean {
  if (!/^\d{2}:\d{2}$/.test(schedule.time) || schedule.notifyUserId.trim().length === 0) {
    return false;
  }
  if (schedule.repeat === "weekly") return schedule.weekdays.length > 0;
  if (schedule.repeat === "monthly") return schedule.monthDay >= 1 && schedule.monthDay <= 31;
  return true;
}

export function useEvalSchedule(
  evalId: string | null,
  onScheduleChange?: (hasSchedule: boolean) => void,
): {
  draft: EvalSchedule;
  setDraft: (next: EvalSchedule) => void;
  members: EvalScheduleMember[];
  runs: EvalScheduledRun[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  created: boolean;
  enabled: boolean;
  dirty: boolean;
  canSubmit: boolean;
  saving: boolean;
  saved: boolean;
  submit: () => void;
  setEnabled: (enabled: boolean) => void;
} {
  const [baseline, setBaseline] = useState<EvalSchedule>(defaultSchedule);
  const [draft, setDraft] = useState<EvalSchedule>(defaultSchedule);
  const [created, setCreated] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [members, setMembers] = useState<EvalScheduleMember[]>([]);
  const [runs, setRuns] = useState<EvalScheduledRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useTransientBooleanReset(saved, setSaved, TRANSIENT_SUCCESS_FEEDBACK_MS);

  const loadSchedule = useCallback(async (id: string) => {
    try {
      const res = await api.get<{ schedule: ScheduleApi }>(`/api/user/evals/${id}/schedule`);
      const next = fromApi(res.schedule);
      setBaseline(next);
      setDraft(next);
      setCreated(true);
      setEnabledState(res.schedule.enabled !== false);
    } catch {
      const next = defaultSchedule();
      setBaseline(next);
      setDraft(next);
      setCreated(false);
      setEnabledState(false);
    }
  }, []);

  const loadRuns = useCallback(async (id: string, nextPage: number) => {
    try {
      const res = await api.get<{
        runs: EvalScheduledRun[];
        total: number;
      }>(
        `/api/user/evals/${id}/scheduled-runs?page=${nextPage}&pageSize=${EVAL_SUITE_RUN_PAGE_SIZE}`,
      );
      setRuns(res.runs);
      setTotal(res.total);
    } catch {
      setRuns([]);
      setTotal(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ members: TeamMemberRecord[] }>("/api/user/team");
        if (cancelled) return;
        setMembers(
          (res.members ?? [])
            .filter((member) => Boolean(member.email?.trim()))
            .map((member) => ({
              userId: member.userId,
              email: member.email!.trim(),
            })),
        );
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!evalId) return;
    setPage(1);
    setSaved(false);
    void loadSchedule(evalId);
  }, [evalId, loadSchedule]);

  useEffect(() => {
    if (!evalId) return;
    void loadRuns(evalId, page);
  }, [evalId, page, loadRuns]);

  const dirty = !schedulesEqual(draft, baseline);
  const canSubmit = isScheduleValid(draft) && !saving && (created ? dirty : true);

  const submit = useCallback(() => {
    if (!canSubmit || !evalId) return;
    setSaving(true);
    const payload = toApi(draft);
    const request = created
      ? api.put<{ schedule: ScheduleApi }>(`/api/user/evals/${evalId}/schedule`, payload)
      : api.post<{ schedule: ScheduleApi }>(`/api/user/evals/${evalId}/schedule`, payload);
    void request
      .then((res) => {
        const next = fromApi(res.schedule);
        setBaseline(next);
        setDraft(next);
        setCreated(true);
        setEnabledState(res.schedule.enabled !== false);
        onScheduleChange?.(res.schedule.enabled !== false);
        setSaved(true);
      })
      .catch(() => undefined)
      .finally(() => {
        setSaving(false);
      });
  }, [canSubmit, created, draft, evalId, onScheduleChange]);

  const setEnabled = useCallback(
    (nextEnabled: boolean) => {
      if (!evalId || !created || saving) return;
      setSaving(true);
      void api
        .patch<{ schedule: ScheduleApi }>(`/api/user/evals/${evalId}/schedule`, {
          enabled: nextEnabled,
        })
        .then((res) => {
          setEnabledState(res.schedule.enabled);
          onScheduleChange?.(res.schedule.enabled);
        })
        .catch(() => undefined)
        .finally(() => {
          setSaving(false);
        });
    },
    [created, evalId, onScheduleChange, saving],
  );

  return {
    draft,
    setDraft,
    members,
    runs,
    total,
    page,
    setPage,
    created,
    enabled,
    dirty,
    canSubmit,
    saving,
    saved,
    submit,
    setEnabled,
  };
}

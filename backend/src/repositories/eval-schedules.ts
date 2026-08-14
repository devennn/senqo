import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { evalRuns, evalSchedules, workspaceHandoffTopicEntries } from "../db/schema/index.js";
import { listPageOffset } from "../lib/pagination.js";
import type {
  CreateEvalScheduleInput,
  EvalScheduleRecord,
  EvalScheduleRepeat,
  EvalScheduledRunRecord,
  UpdateEvalScheduleInput,
} from "../types/evals.js";

const scope = "EvalSchedulesRepository";

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseRepeat(raw: string): EvalScheduleRepeat {
  if (raw === "weekly" || raw === "monthly") return raw;
  return "daily";
}

function parseWeekdays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const days: number[] = [];
  for (const item of raw) {
    const value = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(value) || value < 0 || value > 6) continue;
    if (!days.includes(value)) days.push(value);
  }
  return days.sort((a, b) => a - b);
}

function toScheduleRecord(row: {
  id: string;
  workspaceId: string;
  evalCaseId: string;
  repeat: string;
  weekdays: unknown;
  monthDay: number | null;
  hour: number;
  minute: number;
  timezone: string;
  notifyUserId: string | null;
  enabled: boolean;
  lastFiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EvalScheduleRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    evalCaseId: row.evalCaseId,
    repeat: parseRepeat(row.repeat),
    weekdays: parseWeekdays(row.weekdays),
    monthDay: row.monthDay,
    hour: row.hour,
    minute: row.minute,
    timezone: row.timezone,
    notifyUserId: row.notifyUserId,
    enabled: row.enabled,
    lastFiredAt: row.lastFiredAt ? asIso(row.lastFiredAt) : null,
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt),
  };
}

export async function listEvalCaseIdsWithSchedule(
  workspaceId: string,
  evalCaseIds: string[],
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (evalCaseIds.length === 0) return ids;
  try {
    const rows = await db
      .select({ evalCaseId: evalSchedules.evalCaseId })
      .from(evalSchedules)
      .where(
        and(
          eq(evalSchedules.workspaceId, workspaceId),
          inArray(evalSchedules.evalCaseId, evalCaseIds),
          eq(evalSchedules.enabled, true),
        ),
      );
    for (const row of rows) ids.add(row.evalCaseId);
    console.info(
      `[${scope}/listEvalCaseIdsWithSchedule] Success: userId=${workspaceId} count=${ids.size}`,
    );
    return ids;
  } catch (error) {
    console.error(`[${scope}/listEvalCaseIdsWithSchedule] Unexpected error: ${String(error)}`);
    return ids;
  }
}

export async function getEvalScheduleByEvalCaseId(
  workspaceId: string,
  evalCaseId: string,
): Promise<EvalScheduleRecord | null> {
  try {
    const rows = await db
      .select()
      .from(evalSchedules)
      .where(
        and(
          eq(evalSchedules.workspaceId, workspaceId),
          eq(evalSchedules.evalCaseId, evalCaseId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      console.info(
        `[${scope}/getEvalScheduleByEvalCaseId] Success: no row userId=${workspaceId} id=${evalCaseId}`,
      );
      return null;
    }
    console.info(
      `[${scope}/getEvalScheduleByEvalCaseId] Success: userId=${workspaceId} id=${evalCaseId}`,
    );
    return toScheduleRecord(row);
  } catch (error) {
    console.error(`[${scope}/getEvalScheduleByEvalCaseId] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createEvalSchedule(
  input: CreateEvalScheduleInput,
): Promise<{ ok: true; id: string } | { ok: false; error: "exists" | "failed" }> {
  try {
    const existing = await getEvalScheduleByEvalCaseId(input.workspaceId, input.evalCaseId);
    if (existing) {
      console.info(
        `[${scope}/createEvalSchedule] Failed query: exists userId=${input.workspaceId} id=${input.evalCaseId}`,
      );
      return { ok: false, error: "exists" };
    }
    const inserted = await db
      .insert(evalSchedules)
      .values({
        workspaceId: input.workspaceId,
        evalCaseId: input.evalCaseId,
        repeat: input.repeat,
        weekdays: input.weekdays,
        monthDay: input.monthDay,
        hour: input.hour,
        minute: input.minute,
        timezone: input.timezone,
        notifyUserId: input.notifyUserId,
      })
      .returning({ id: evalSchedules.id });
    const id = inserted[0]?.id;
    if (!id) {
      console.error(`[${scope}/createEvalSchedule] Failed query: missing id`);
      return { ok: false, error: "failed" };
    }
    console.info(
      `[${scope}/createEvalSchedule] Success: userId=${input.workspaceId} id=${id}`,
    );
    return { ok: true, id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createEvalSchedule] Failed query: ${message}`);
    return { ok: false, error: "failed" };
  }
}

export async function updateEvalSchedule(
  workspaceId: string,
  evalCaseId: string,
  patch: UpdateEvalScheduleInput,
): Promise<{ ok: boolean }> {
  try {
    const updated = await db
      .update(evalSchedules)
      .set({
        repeat: patch.repeat,
        weekdays: patch.weekdays,
        monthDay: patch.monthDay,
        hour: patch.hour,
        minute: patch.minute,
        timezone: patch.timezone,
        notifyUserId: patch.notifyUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(evalSchedules.workspaceId, workspaceId),
          eq(evalSchedules.evalCaseId, evalCaseId),
        ),
      )
      .returning({ id: evalSchedules.id });
    if (!updated[0]) {
      console.info(
        `[${scope}/updateEvalSchedule] Failed query: not found userId=${workspaceId} id=${evalCaseId}`,
      );
      return { ok: false };
    }
    console.info(
      `[${scope}/updateEvalSchedule] Success: userId=${workspaceId} id=${evalCaseId}`,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/updateEvalSchedule] Unexpected error: ${message}`);
    return { ok: false };
  }
}

export async function setEvalScheduleEnabled(
  workspaceId: string,
  evalCaseId: string,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  try {
    const updated = await db
      .update(evalSchedules)
      .set({ enabled, updatedAt: new Date() })
      .where(
        and(
          eq(evalSchedules.workspaceId, workspaceId),
          eq(evalSchedules.evalCaseId, evalCaseId),
        ),
      )
      .returning({ id: evalSchedules.id });
    if (!updated[0]) {
      console.info(
        `[${scope}/setEvalScheduleEnabled] Failed query: not found userId=${workspaceId} id=${evalCaseId}`,
      );
      return { ok: false };
    }
    console.info(
      `[${scope}/setEvalScheduleEnabled] Success: userId=${workspaceId} id=${evalCaseId} enabled=${enabled}`,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/setEvalScheduleEnabled] Unexpected error: ${message}`);
    return { ok: false };
  }
}

export async function listAllEvalSchedules(): Promise<EvalScheduleRecord[]> {
  try {
    const rows = await db.select().from(evalSchedules);
    console.info(`[${scope}/listAllEvalSchedules] Success: count=${rows.length}`);
    return rows.map(toScheduleRecord);
  } catch (error) {
    console.error(`[${scope}/listAllEvalSchedules] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function claimEvalScheduleSlot(
  scheduleId: string,
  slotStart: Date,
  firedAt: Date,
): Promise<{ ok: boolean }> {
  try {
    const updated = await db
      .update(evalSchedules)
      .set({ lastFiredAt: firedAt })
      .where(
        and(
          eq(evalSchedules.id, scheduleId),
          or(isNull(evalSchedules.lastFiredAt), lt(evalSchedules.lastFiredAt, slotStart)),
        ),
      )
      .returning({ id: evalSchedules.id });
    if (!updated[0]) {
      console.info(
        `[${scope}/claimEvalScheduleSlot] Failed query: already fired id=${scheduleId}`,
      );
      return { ok: false };
    }
    console.info(`[${scope}/claimEvalScheduleSlot] Success: id=${scheduleId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/claimEvalScheduleSlot] Unexpected error: ${String(error)}`);
    return { ok: false };
  }
}

export async function listScheduledRunsPage(input: {
  workspaceId: string;
  evalCaseId: string;
  page: number;
  pageSize: number;
}): Promise<{ items: EvalScheduledRunRecord[]; total: number }> {
  const { workspaceId, evalCaseId, page, pageSize } = input;
  const offset = listPageOffset(page, pageSize);
  try {
    const where = and(
      eq(evalRuns.workspaceId, workspaceId),
      eq(evalRuns.evalCaseId, evalCaseId),
      isNotNull(evalRuns.scheduleId),
    );
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evalRuns)
      .where(where);
    const rows = await db
      .select({
        id: evalRuns.id,
        status: evalRuns.status,
        actualReply: evalRuns.actualReply,
        answerAnalysis: evalRuns.answerAnalysis,
        reasoningForOperators: evalRuns.reasoningForOperators,
        handoffCalled: evalRuns.handoffCalled,
        handoffTopicEntryId: evalRuns.handoffTopicEntryId,
        handoffTopicLabel: workspaceHandoffTopicEntries.title,
        errorMessage: evalRuns.errorMessage,
        subjectSessionId: evalRuns.subjectSessionId,
        ranAt: evalRuns.ranAt,
        emailSent: evalRuns.emailSent,
        notifyEmail: evalRuns.notifyEmail,
      })
      .from(evalRuns)
      .leftJoin(
        workspaceHandoffTopicEntries,
        eq(evalRuns.handoffTopicEntryId, workspaceHandoffTopicEntries.id),
      )
      .where(where)
      .orderBy(desc(evalRuns.ranAt))
      .limit(pageSize)
      .offset(offset);
    const items: EvalScheduledRunRecord[] = rows.map((row) => ({
      id: row.id,
      status: row.status === "passed" || row.status === "error" ? row.status : "failed",
      actualReply: row.actualReply,
      answerAnalysis: row.answerAnalysis,
      reasoningForOperators: row.reasoningForOperators,
      handoffCalled: Boolean(row.handoffCalled),
      handoffTopicEntryId: row.handoffTopicEntryId,
      handoffTopicLabel: row.handoffTopicLabel,
      errorMessage: row.errorMessage,
      subjectSessionId: row.subjectSessionId,
      ranAt: asIso(row.ranAt),
      emailSent: Boolean(row.emailSent),
      notifyEmail: row.notifyEmail,
    }));
    console.info(
      `[${scope}/listScheduledRunsPage] Success: userId=${workspaceId} id=${evalCaseId} total=${countRow?.count ?? 0}`,
    );
    return { items, total: countRow?.count ?? 0 };
  } catch (error) {
    console.error(`[${scope}/listScheduledRunsPage] Unexpected error: ${String(error)}`);
    return { items: [], total: 0 };
  }
}

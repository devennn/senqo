import { findUserById } from "../repositories/auth-users.js";
import { getEvalCaseById, markEvalRunEmailSent } from "../repositories/evals.js";
import { getEvalScheduleByEvalCaseId } from "../repositories/eval-schedules.js";
import { isWorkspaceTeammate } from "../repositories/workspaces.js";
import { sendEvalScheduleFailureEmail } from "./email.js";
import { runAndPersistEvalCase } from "./eval-run.js";
import type { EvalRunStatus } from "../types/evals.js";
import type { EvalScheduleRunPayload } from "./eval-schedule-tick.js";

const scope = "EvalScheduleRun";

export async function notifyEvalScheduleIfNeeded(input: {
  workspaceId: string;
  evalCaseId: string;
  evalTitle: string;
  runId: string;
  status: EvalRunStatus;
  notifyUserId: string | null;
}): Promise<void> {
  if (input.status !== "failed" && input.status !== "error") return;
  if (!input.notifyUserId) {
    console.info(
      `[${scope}/notifyEvalScheduleIfNeeded] Failed query: missing notify user evalCaseId=${input.evalCaseId}`,
    );
    return;
  }

  const teammate = await isWorkspaceTeammate(input.workspaceId, input.notifyUserId);
  if (!teammate) {
    console.info(
      `[${scope}/notifyEvalScheduleIfNeeded] Failed query: not a teammate userId=${input.notifyUserId}`,
    );
    return;
  }

  const user = await findUserById(input.notifyUserId);
  const email = user?.email?.trim() ?? "";
  if (!email) {
    console.info(
      `[${scope}/notifyEvalScheduleIfNeeded] Failed query: no email userId=${input.notifyUserId}`,
    );
    return;
  }

  const sent = await sendEvalScheduleFailureEmail({
    to: email,
    workspaceId: input.workspaceId,
    evalCaseId: input.evalCaseId,
    evalTitle: input.evalTitle,
    status: input.status,
  });
  if (!sent.ok) {
    console.info(
      `[${scope}/notifyEvalScheduleIfNeeded] Failed query: email send failed evalCaseId=${input.evalCaseId}`,
    );
    return;
  }

  await markEvalRunEmailSent(input.workspaceId, input.runId, email);
}

export async function executeEvalScheduleRun(
  payload: EvalScheduleRunPayload,
): Promise<{ ok: boolean }> {
  const evalCase = await getEvalCaseById(payload.workspaceId, payload.evalCaseId);
  if (!evalCase) {
    console.info(
      `[${scope}/executeEvalScheduleRun] Failed query: not found evalCaseId=${payload.evalCaseId}`,
    );
    return { ok: true };
  }

  const result = await runAndPersistEvalCase({
    workspaceId: payload.workspaceId,
    evalCaseId: payload.evalCaseId,
    scheduleId: payload.scheduleId,
  });
  if (!result.ok) {
    console.info(
      `[${scope}/executeEvalScheduleRun] Failed query: ${result.error} evalCaseId=${payload.evalCaseId}`,
    );
    return { ok: true };
  }

  const schedule = await getEvalScheduleByEvalCaseId(
    payload.workspaceId,
    payload.evalCaseId,
  );
  await notifyEvalScheduleIfNeeded({
    workspaceId: payload.workspaceId,
    evalCaseId: payload.evalCaseId,
    evalTitle: result.evalCase.title,
    runId: result.runId,
    status: result.status,
    notifyUserId: schedule?.notifyUserId ?? null,
  });

  console.info(
    `[${scope}/executeEvalScheduleRun] Success: evalCaseId=${payload.evalCaseId} status=${result.status}`,
  );
  return { ok: true };
}

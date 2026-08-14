import { stripTrailingAssistantTurns } from "../agent-evals/conversation-to-turns.js";
import { runEvalCase } from "../agent-evals/index.js";
import {
  createEvalRun,
  getEvalCaseById,
  updateEvalCase,
} from "../repositories/evals.js";
import type { EvalCaseRecord, EvalRunStatus } from "../types/evals.js";

export type RunAndPersistEvalCaseResult =
  | {
      ok: true;
      evalCase: EvalCaseRecord;
      runId: string;
      status: EvalRunStatus;
    }
  | { ok: false; error: string; httpStatus: 400 | 404 | 500 };

export async function runAndPersistEvalCase(input: {
  workspaceId: string;
  evalCaseId: string;
  scheduleId?: string | null;
}): Promise<RunAndPersistEvalCaseResult> {
  const existing = await getEvalCaseById(input.workspaceId, input.evalCaseId);
  if (!existing) return { ok: false, error: "not_found", httpStatus: 404 };
  if (existing.expectedAction === "reply" && !existing.expectedReply.trim()) {
    return { ok: false, error: "expected_reply_required", httpStatus: 400 };
  }
  if (existing.expectedAction === "handoff" && !existing.expectedTopicEntryId) {
    return { ok: false, error: "expected_topic_required", httpStatus: 400 };
  }

  let ran;
  try {
    ran = await runEvalCase({
      workspaceId: input.workspaceId,
      agentConfigId: existing.agentId,
      turns: stripTrailingAssistantTurns(existing.turns),
      expectedAction: existing.expectedAction,
      expectedReply: existing.expectedReply,
      expectedTopicEntryId: existing.expectedTopicEntryId,
      expectedTopicLabel: existing.expectedTopicLabel,
    });
  } catch (error) {
    ran = {
      status: "error" as const,
      sessionId: null,
      actualReply: "",
      reasoningForOperators: null,
      handoffCalled: false,
      handoffTopicEntryId: null,
      answerAnalysis: null,
      errorMessage: error instanceof Error ? error.message : "Eval run failed unexpectedly.",
    };
  }

  const createdRun = await createEvalRun({
    workspaceId: input.workspaceId,
    evalCaseId: input.evalCaseId,
    status: ran.status,
    actualReply: ran.actualReply,
    answerAnalysis: ran.answerAnalysis,
    reasoningForOperators: ran.reasoningForOperators,
    handoffCalled: ran.handoffCalled,
    handoffTopicEntryId: ran.handoffTopicEntryId,
    errorMessage: ran.errorMessage,
    subjectSessionId: ran.sessionId,
    scheduleId: input.scheduleId ?? null,
  });
  if (!createdRun.ok) return { ok: false, error: "persist_run_failed", httpStatus: 500 };

  if (ran.status === "passed" || ran.status === "failed") {
    await updateEvalCase(input.workspaceId, input.evalCaseId, {
      answerCorrect: ran.status === "passed",
      answerAnalysis: ran.answerAnalysis,
    });
  }

  const evalCase = await getEvalCaseById(input.workspaceId, input.evalCaseId);
  if (!evalCase) return { ok: false, error: "not_found", httpStatus: 404 };
  return { ok: true, evalCase, runId: createdRun.id, status: ran.status };
}

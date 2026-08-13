import type { EvalExpectedAction, EvalRunStatus, EvalTurn } from "../types/evals.js";
import {
  draftEvalFromHandoff,
  draftEvalFromKnowledge,
  draftEvalFromReport,
} from "./spec/agent.js";
import { judgeEvalRun } from "./judge/agent.js";
import { resolveHandoffTopicFromEvidence } from "./resolve-handoff-topic.js";
import { runSubjectEval } from "./subject.js";

export type { DraftEvalFromReportInput, DraftEvalFromReportResult } from "./spec/agent.js";
export type {
  DraftEvalFromKnowledgeInput,
  DraftEvalFromKnowledgeResult,
  DraftEvalFromHandoffInput,
  DraftEvalFromHandoffResult,
} from "./spec/agent.js";
export type { JudgeEvalRunInput, JudgeEvalRunResult } from "./judge/agent.js";
export type { SubjectEvalResult } from "./subject.js";

export {
  draftEvalFromReport,
  draftEvalFromKnowledge,
  draftEvalFromHandoff,
  judgeEvalRun,
  runSubjectEval,
};

export type RunEvalCaseResult = {
  status: EvalRunStatus;
  sessionId: string | null;
  actualReply: string;
  reasoningForOperators: string | null;
  handoffCalled: boolean;
  handoffTopicEntryId: string | null;
  answerAnalysis: string | null;
  errorMessage: string | null;
};

export async function runEvalCase(input: {
  workspaceId: string;
  agentConfigId: string;
  turns: EvalTurn[];
  expectedAction: EvalExpectedAction;
  expectedReply: string;
  expectedTopicEntryId?: string | null;
  expectedTopicLabel?: string | null;
}): Promise<RunEvalCaseResult> {
  const subject = await runSubjectEval({
    workspaceId: input.workspaceId,
    agentConfigId: input.agentConfigId,
    turns: input.turns,
  });
  if (!subject) {
    return {
      status: "error",
      sessionId: null,
      actualReply: "",
      reasoningForOperators: null,
      handoffCalled: false,
      handoffTopicEntryId: null,
      answerAnalysis: null,
      errorMessage: "Subject agent run failed.",
    };
  }

  let handoffTopicEntryId = subject.handoffTopicEntryId;
  if (subject.handoffCalled && !handoffTopicEntryId) {
    const resolved = await resolveHandoffTopicFromEvidence({
      workspaceId: input.workspaceId,
      agentConfigId: input.agentConfigId,
      handoffCalled: subject.handoffCalled,
      topicEntryIdFromTool: subject.handoffTopicEntryId,
      reasoning: subject.reasoningForOperators,
      handoffReason: subject.handoffReason,
      expectedTopicEntryId: input.expectedTopicEntryId,
    });
    if (resolved.topicEntryId) {
      handoffTopicEntryId = resolved.topicEntryId;
    }
  }

  const judged = await judgeEvalRun({
    turns: input.turns,
    expectedAction: input.expectedAction,
    expectedReply: input.expectedReply,
    expectedTopicEntryId: input.expectedTopicEntryId,
    expectedTopicLabel: input.expectedTopicLabel,
    actualReply: subject.actualReply,
    subjectReasoning: subject.reasoningForOperators,
    handoffCalled: subject.handoffCalled,
    handoffTopicEntryId,
  });
  if (!judged.ok) {
    return {
      status: "error",
      sessionId: subject.sessionId,
      actualReply: subject.actualReply,
      reasoningForOperators: subject.reasoningForOperators,
      handoffCalled: subject.handoffCalled,
      handoffTopicEntryId,
      answerAnalysis: null,
      errorMessage: judged.message,
    };
  }

  return {
    status: judged.result.passed ? "passed" : "failed",
    sessionId: subject.sessionId,
    actualReply: subject.actualReply,
    reasoningForOperators: subject.reasoningForOperators,
    handoffCalled: subject.handoffCalled,
    handoffTopicEntryId,
    answerAnalysis: judged.result.answerAnalysis,
    errorMessage: null,
  };
}

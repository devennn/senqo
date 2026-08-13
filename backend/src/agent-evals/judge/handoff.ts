import type { EvalExpectedAction, EvalTurn } from "../../types/evals.js";
import type { EvalJudgeResult } from "./schema.js";

export type JudgeHandoffInput = {
  turns: EvalTurn[];
  expectedAction: EvalExpectedAction;
  expectedReply: string;
  expectedTopicEntryId?: string | null;
  expectedTopicLabel?: string | null;
  actualReply: string;
  handoffCalled: boolean;
  handoffTopicEntryId?: string | null;
};

/** Pass/fail for handoff cases from tool-call outcome (no LLM). */
export function judgeHandoffDeterministic(input: JudgeHandoffInput): EvalJudgeResult {
  const expectedTopic = input.expectedTopicEntryId?.trim() || null;
  const actualTopic = input.handoffTopicEntryId?.trim() || null;
  const topicLabel = input.expectedTopicLabel?.trim() || "the configured topic";

  if (!input.handoffCalled) {
    return {
      passed: false,
      answerAnalysis: `Expected a handoff to a human (${topicLabel}), but the agent did not call handoff_to_human.`,
      critique: "Missing handoff_to_human tool call.",
    };
  }

  if (expectedTopic && actualTopic !== expectedTopic) {
    return {
      passed: false,
      answerAnalysis: `Agent handed off, but used the wrong topic (expected ${topicLabel}).`,
      critique: actualTopic
        ? `topicEntryId mismatch: expected ${expectedTopic}, got ${actualTopic}.`
        : `topicEntryId missing; expected ${expectedTopic}.`,
    };
  }

  return {
    passed: true,
    answerAnalysis: expectedTopic
      ? `Agent handed off with the expected topic (${topicLabel}).`
      : "Agent handed off to a human as expected.",
    critique: "",
  };
}

import { generateText, Output } from "ai";
import { getEvalJudgeLLM } from "../../agent/llm.js";
import type { EvalExpectedAction, EvalTurn } from "../../types/evals.js";
import { EVAL_JUDGE_SYSTEM_PROMPT } from "./prompt.js";
import { judgeHandoffDeterministic } from "./handoff.js";
import { evalJudgeResultSchema, type EvalJudgeResult } from "./schema.js";

const scope = "EvalJudgeAgent";

export type JudgeEvalRunInput = {
  turns: EvalTurn[];
  expectedAction: EvalExpectedAction;
  expectedReply: string;
  expectedTopicEntryId?: string | null;
  expectedTopicLabel?: string | null;
  actualReply: string;
  subjectReasoning?: string | null;
  handoffCalled: boolean;
  handoffTopicEntryId?: string | null;
};

export type JudgeEvalRunResult =
  | { ok: true; result: EvalJudgeResult }
  | { ok: false; message: string };

function formatTurns(turns: EvalTurn[]): string {
  return turns
    .map((turn, index) => `${index + 1}. ${turn.role.toUpperCase()}: ${turn.content}`)
    .join("\n");
}

export async function judgeEvalRun(
  input: JudgeEvalRunInput,
): Promise<JudgeEvalRunResult> {
  if (input.expectedAction === "handoff") {
    try {
      const result = judgeHandoffDeterministic(input);
      console.info(
        `[${scope}/judgeEvalRun] Success: action=handoff passed=${String(result.passed)}`,
      );
      return { ok: true, result };
    } catch (error) {
      console.error(`[${scope}/judgeEvalRun] Unexpected error: ${String(error)}`);
      return { ok: false, message: "Could not judge handoff eval run." };
    }
  }

  const expectedReply = input.expectedReply.trim();
  const actualReply = input.actualReply.trim();
  if (!expectedReply) {
    return { ok: false, message: "Expected reply is required." };
  }

  try {
    const result = await generateText({
      model: getEvalJudgeLLM(),
      output: Output.object({ schema: evalJudgeResultSchema }),
      prompt: [
        EVAL_JUDGE_SYSTEM_PROMPT,
        "",
        "Conversation turns:",
        formatTurns(input.turns),
        "",
        "Expected reply:",
        expectedReply,
        "",
        "Actual reply:",
        actualReply || "(empty)",
        "",
        "Subject reasoning (optional):",
        input.subjectReasoning?.trim() || "(none)",
        "",
        "Subject also called handoff_to_human:",
        input.handoffCalled ? "yes" : "no",
      ].join("\n"),
    });

    console.info(
      `[${scope}/judgeEvalRun] Success: action=reply passed=${String(result.output.passed)}`,
    );
    return { ok: true, result: result.output };
  } catch (error) {
    console.error(`[${scope}/judgeEvalRun] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not judge eval run." };
  }
}

export { judgeHandoffDeterministic };

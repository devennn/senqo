import { z } from "zod";

/** All keys required — Azure/OpenAI structured output rejects optional properties. */
export const evalJudgeResultSchema = z.object({
  passed: z.boolean(),
  answerAnalysis: z.string().min(1),
  /** Extra notes; use empty string when none. */
  critique: z.string(),
});

export type EvalJudgeResult = z.infer<typeof evalJudgeResultSchema>;

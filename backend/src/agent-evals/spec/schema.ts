import { z } from "zod";

export const evalKnowledgeKindSchema = z.enum([
  "context",
  "template",
  "skill",
  "handoff",
]);

export const evalKnowledgeRefSchema = z.object({
  kind: evalKnowledgeKindSchema,
  label: z.string().min(1),
});

/** All keys required — Azure/OpenAI structured output rejects optional properties. */
export const evalTurnDraftSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  whyReply: z.string(),
  sources: z.array(evalKnowledgeRefSchema),
});

export const evalSpecDraftSchema = z.object({
  title: z.string().min(1),
  turns: z.array(evalTurnDraftSchema).min(1),
  expectedReply: z.string().min(1),
  answerAnalysis: z.string().min(1),
  answerCorrect: z.boolean(),
});

export type EvalSpecDraft = z.infer<typeof evalSpecDraftSchema>;

/** Knowledge → Eval: Spec invents conversation; expected reply comes from the entry. */
export const evalKnowledgeDraftSchema = z.object({
  title: z.string().min(1),
  turns: z.array(evalTurnDraftSchema).min(1),
  answerAnalysis: z.string().min(1),
});

export type EvalKnowledgeDraft = z.infer<typeof evalKnowledgeDraftSchema>;

export const EVAL_SPEC_SYSTEM_PROMPT = [
  "You draft durable agent evaluation cases from a WhatsApp conversation snapshot and operator guidance.",
  "Return structured fields only: title, turns, expectedReply, answerAnalysis, answerCorrect.",
  "Rules:",
  "- title: short, specific case name (not generic).",
  "- turns: keep the conversation as a clean user/assistant transcript. Preserve customer wording. Drop thread-event noise.",
  "- Each turn must include whyReply (string; empty for user turns or when unknown) and sources (array; empty when none).",
  "- For assistant turns, fill whyReply when operator reasoning or your analysis explains the reply; sources may list context/template/skill/handoff labels when known.",
  "- expectedReply: write the golden assistant reply the subject agent should produce for the last customer ask, using the operator's expected-reply guidance.",
  "- answerAnalysis: explain what was wrong or notable using the operator's answer-analysis guidance.",
  "- answerCorrect: false for reports of bad replies unless the operator clearly says the reply was correct.",
  "- turns must end on the customer message(s) under test. Do not include the assistant reply being reported — Run eval regenerates that reply.",
  "- Do not invent unrelated facts; stay faithful to the transcript, guidance, and business context when provided.",
].join("\n");

/** Spec prompt for Knowledge → Eval: invent conversation turns; expected reply is fixed elsewhere. */
export const EVAL_SPEC_FROM_KNOWLEDGE_SYSTEM_PROMPT = [
  "You draft a WhatsApp evaluation conversation that tests whether an agent correctly uses a knowledge base entry.",
  "Return structured fields only: title, turns, answerAnalysis.",
  "Rules:",
  "- title: short, specific case name for this knowledge check.",
  "- turns: invent a short realistic customer↔assistant transcript (1–6 turns) that leads to the customer asking about this knowledge.",
  "- Each turn must include whyReply (string; empty for user turns) and sources (array; empty when none).",
  "- turns must end on the customer message(s) under test. Do not include the final assistant answer — Run eval regenerates that reply.",
  "- The last customer ask should naturally require the provided knowledge content as the correct reply.",
  "- You may paraphrase the seed question; keep the intent. Do not invent conflicting facts.",
  "- Stay consistent with the business context when provided (what the business sells, how it operates, tone).",
  "- answerAnalysis: one short paragraph stating what this case checks (grounded in the knowledge).",
  "- Do not invent an expected reply; that is supplied from the knowledge entry separately.",
].join("\n");

/** Spec prompt for Knowledge → Human handoff → Eval. */
export const EVAL_SPEC_FROM_HANDOFF_SYSTEM_PROMPT = [
  "You draft a WhatsApp evaluation conversation that should trigger a human handoff topic.",
  "Return structured fields only: title, turns, answerAnalysis.",
  "Rules:",
  "- title: short, specific case name for this handoff check.",
  "- turns: invent a short realistic customer↔assistant transcript (1–6 turns) that leads to the customer needing this handoff topic.",
  "- Each turn must include whyReply (string; empty for user turns) and sources (array; empty when none).",
  "- turns must end on the customer message(s) under test. Do not include the final assistant answer or handoff — Run eval regenerates that.",
  "- The last customer ask should clearly match the handoff topic (use the topic title and description).",
  "- Stay consistent with the business context when provided.",
  "- answerAnalysis: one short paragraph stating that this case expects handoff_to_human for this topic.",
  "- Do not invent an expected customer reply; the golden outcome is the handoff action.",
].join("\n");

export function formatBusinessContextBlock(businessContext: string): string {
  const text = businessContext.trim();
  if (!text) return "";
  return ["Business context (what this business is about — stay consistent with it):", text].join(
    "\n",
  );
}

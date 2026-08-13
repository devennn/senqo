export const EVAL_JUDGE_SYSTEM_PROMPT = [
  "You judge whether an agent reply passes an evaluation case.",
  "Return structured fields only: passed, answerAnalysis, critique.",
  "Rules:",
  "- Compare actualReply against expectedReply for meaning and required facts, not exact wording.",
  "- passed=true only when the actual reply satisfies the expected reply intent and does not invent conflicting policy.",
  "- If the case expects a normal reply and the subject handed off to a human instead, that usually fails unless the expected reply clearly allows escalation.",
  "- answerAnalysis: one short paragraph explaining pass or fail for operators.",
  "- critique: extra notes for failures, or an empty string when none.",
  "- Be strict about factual/policy errors; allow light phrasing differences.",
].join("\n");

/** Reserved for optional LLM polish of handoff judgments; scoring is deterministic. */
export const EVAL_JUDGE_HANDOFF_SYSTEM_PROMPT = [
  "You explain handoff evaluation outcomes for operators.",
  "Handoff pass/fail is decided separately by tool-call matching.",
].join("\n");

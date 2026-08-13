import { generateText, Output } from "ai";
import { getEvalSpecLLM } from "../../agent/llm.js";
import type { EvalKnowledgeKind, EvalTurn } from "../../types/evals.js";
import {
  EVAL_SPEC_FROM_HANDOFF_SYSTEM_PROMPT,
  EVAL_SPEC_FROM_KNOWLEDGE_SYSTEM_PROMPT,
  EVAL_SPEC_SYSTEM_PROMPT,
  formatBusinessContextBlock,
} from "./prompt.js";
import {
  evalKnowledgeDraftSchema,
  evalSpecDraftSchema,
  type EvalKnowledgeDraft,
  type EvalSpecDraft,
} from "./schema.js";

const scope = "EvalSpecAgent";

export type DraftEvalFromReportInput = {
  conversationTitle: string;
  agentName: string;
  turns: EvalTurn[];
  answerAnalysisGuidance: string;
  expectedReplyGuidance: string;
  /** Agent profile + attached workspace context facts. */
  businessContext?: string;
};

export type DraftEvalFromReportResult =
  | { ok: true; draft: EvalSpecDraft }
  | { ok: false; message: string };

export type DraftEvalFromKnowledgeInput = {
  kind: Extract<EvalKnowledgeKind, "template" | "context">;
  groupName: string;
  agentName: string;
  /** Template question or context fact title — seed for the customer ask. */
  seedPrompt: string;
  /** Template answer or context body — shown to Spec for grounding only; not overwritten. */
  expectedReply: string;
  /** Agent profile + attached workspace context facts. */
  businessContext?: string;
};

export type DraftEvalFromKnowledgeResult =
  | { ok: true; draft: EvalKnowledgeDraft }
  | { ok: false; message: string };

export type DraftEvalFromHandoffInput = {
  groupName: string;
  agentName: string;
  topicTitle: string;
  topicDescription: string;
  topicEntryId: string;
  businessContext?: string;
};

export type DraftEvalFromHandoffResult =
  | { ok: true; draft: EvalKnowledgeDraft }
  | { ok: false; message: string };

function formatTurnsForPrompt(turns: EvalTurn[]): string {
  return turns
    .map((turn, index) => {
      const bits = [
        `${index + 1}. ${turn.role.toUpperCase()}: ${turn.content || "(empty)"}`,
      ];
      if (turn.media?.fileName) {
        bits.push(`   media: ${turn.media.fileName}`);
      }
      if (turn.whyReply) {
        bits.push(`   whyReply: ${turn.whyReply}`);
      }
      if (turn.sources && turn.sources.length > 0) {
        bits.push(
          `   sources: ${turn.sources.map((s) => `${s.kind}:${s.label}`).join(", ")}`,
        );
      }
      return bits.join("\n");
    })
    .join("\n");
}

export async function draftEvalFromReport(
  input: DraftEvalFromReportInput,
): Promise<DraftEvalFromReportResult> {
  const analysis = input.answerAnalysisGuidance.trim();
  const expectedGuidance = input.expectedReplyGuidance.trim();
  if (!analysis || !expectedGuidance) {
    return { ok: false, message: "Answer analysis and expected-reply guidance are required." };
  }
  if (input.turns.length === 0) {
    return { ok: false, message: "Conversation has no turns to draft from." };
  }

  try {
    const businessBlock = formatBusinessContextBlock(input.businessContext ?? "");
    const result = await generateText({
      model: getEvalSpecLLM(),
      output: Output.object({ schema: evalSpecDraftSchema }),
      prompt: [
        EVAL_SPEC_SYSTEM_PROMPT,
        "",
        `Conversation title: ${input.conversationTitle || "(untitled)"}`,
        `Subject agent: ${input.agentName || "Agent"}`,
        ...(businessBlock ? ["", businessBlock] : []),
        "",
        "Transcript:",
        formatTurnsForPrompt(input.turns),
        "",
        "Operator answer analysis guidance:",
        analysis,
        "",
        "Operator expected-reply guidance:",
        expectedGuidance,
      ].join("\n"),
    });

    const draft = result.output;
    console.info(
      `[${scope}/draftEvalFromReport] Success: title=${draft.title} turns=${draft.turns.length}`,
    );
    return { ok: true, draft };
  } catch (error) {
    console.error(`[${scope}/draftEvalFromReport] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not draft eval from conversation." };
  }
}

export async function draftEvalFromKnowledge(
  input: DraftEvalFromKnowledgeInput,
): Promise<DraftEvalFromKnowledgeResult> {
  const seedPrompt = input.seedPrompt.trim();
  const expectedReply = input.expectedReply.trim();
  if (!seedPrompt || !expectedReply) {
    return { ok: false, message: "Knowledge entry is incomplete." };
  }

  const kindLabel = input.kind === "template" ? "response template" : "workspace context fact";

  try {
    const businessBlock = formatBusinessContextBlock(input.businessContext ?? "");
    const result = await generateText({
      model: getEvalSpecLLM(),
      output: Output.object({ schema: evalKnowledgeDraftSchema }),
      prompt: [
        EVAL_SPEC_FROM_KNOWLEDGE_SYSTEM_PROMPT,
        "",
        `Subject agent: ${input.agentName || "Agent"}`,
        `Knowledge kind: ${kindLabel}`,
        `Knowledge group: ${input.groupName || "(unnamed)"}`,
        ...(businessBlock ? ["", businessBlock] : []),
        "",
        "Seed customer ask / topic:",
        seedPrompt,
        "",
        "Authoritative expected reply (use only to shape the last customer ask; do not rewrite it):",
        expectedReply,
      ].join("\n"),
    });

    const draft = result.output;
    console.info(
      `[${scope}/draftEvalFromKnowledge] Success: title=${draft.title} turns=${draft.turns.length} kind=${input.kind}`,
    );
    return { ok: true, draft };
  } catch (error) {
    console.error(`[${scope}/draftEvalFromKnowledge] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not draft eval conversation from knowledge." };
  }
}

export async function draftEvalFromHandoff(
  input: DraftEvalFromHandoffInput,
): Promise<DraftEvalFromHandoffResult> {
  const topicTitle = input.topicTitle.trim();
  const topicDescription = input.topicDescription.trim();
  if (!topicTitle) {
    return { ok: false, message: "Handoff topic is incomplete." };
  }

  try {
    const businessBlock = formatBusinessContextBlock(input.businessContext ?? "");
    const result = await generateText({
      model: getEvalSpecLLM(),
      output: Output.object({ schema: evalKnowledgeDraftSchema }),
      prompt: [
        EVAL_SPEC_FROM_HANDOFF_SYSTEM_PROMPT,
        "",
        `Subject agent: ${input.agentName || "Agent"}`,
        `Handoff group: ${input.groupName || "(unnamed)"}`,
        `Handoff topic entry id (agent must pass this as topicEntryId): ${input.topicEntryId}`,
        ...(businessBlock ? ["", businessBlock] : []),
        "",
        "Handoff topic title:",
        topicTitle,
        "",
        "Handoff topic description (when to escalate):",
        topicDescription || "(none)",
      ].join("\n"),
    });

    const draft = result.output;
    console.info(
      `[${scope}/draftEvalFromHandoff] Success: title=${draft.title} turns=${draft.turns.length}`,
    );
    return { ok: true, draft };
  } catch (error) {
    console.error(`[${scope}/draftEvalFromHandoff] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not draft eval conversation from handoff topic." };
  }
}

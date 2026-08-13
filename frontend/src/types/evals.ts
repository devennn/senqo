import type { ConversationMessageMedia } from "@/types/repositories";

export type EvalTurnRole = "user" | "assistant";

export type EvalKnowledgeKind = "context" | "template" | "skill" | "handoff";

/** Where an AI reply pulled facts or wording from. */
export type EvalKnowledgeRef = {
  kind: EvalKnowledgeKind;
  label: string;
};

export type EvalTurn = {
  role: EvalTurnRole;
  content: string;
  media?: ConversationMessageMedia | null;
  /** Assistant-only: reasoning for the reply (shown as Reasoning, like live chat). */
  whyReply?: string | null;
  /** Assistant-only: knowledge references used for the reply. */
  sources?: EvalKnowledgeRef[];
};

export type EvalSource =
  | "manual"
  | "conversation"
  | "template"
  | "context"
  | "handoff";

/** What Run eval scores: golden reply text vs handoff tool call. */
export type EvalExpectedAction = "reply" | "handoff";

export type EvalCaseStatus = "draft" | "ready";

/** Answer outcome vs runtime failure (subject/judge/infra). */
export type EvalRunStatus = "passed" | "failed" | "error";

export type EvalRun = {
  id: string;
  status: EvalRunStatus;
  actualReply: string;
  answerAnalysis?: string | null;
  /** Subject agent reasoning_for_operators — same text as live chat Reasoning. */
  reasoningForOperators?: string | null;
  handoffCalled?: boolean;
  handoffTopicEntryId?: string | null;
  /** Topic title the subject passed to handoff_to_human, when any. */
  handoffTopicLabel?: string | null;
  errorMessage?: string | null;
  ranAt: string;
};

export type EvalCase = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  source: EvalSource;
  status: EvalCaseStatus;
  turns: EvalTurn[];
  /** Golden reply Run eval compares against (AI-drafted, user-editable). Unused for handoff action cases. */
  expectedReply: string;
  expectedAction: EvalExpectedAction;
  expectedTopicEntryId: string | null;
  /** Topic title when expectedAction is handoff. */
  expectedTopicLabel: string | null;
  /** Topic description when expectedAction is handoff. */
  expectedTopicDescription: string | null;
  /** Why the agent answer was correct or incorrect. */
  answerAnalysis: string | null;
  /** Colors the analysis panel: true = green, false = red. */
  answerCorrect: boolean | null;
  sourceConversationId: string | null;
  /** Newest first. */
  runs: EvalRun[];
  createdAt: string;
};

export type EvalAgentOption = {
  id: string;
  name: string;
};

export type CreateManualEvalInput = {
  title: string;
  agentId: string;
  userMessage: string;
  expectedReply: string;
};

export type CreateFromConversationInput = {
  conversationId: string;
  answerAnalysis: string;
  expectedGuidance: string;
  agentId?: string;
};

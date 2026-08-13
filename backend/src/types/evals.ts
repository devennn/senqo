export type EvalTurnRole = "user" | "assistant";

export type EvalKnowledgeKind = "context" | "template" | "skill" | "handoff";

export type EvalKnowledgeRef = {
  kind: EvalKnowledgeKind;
  label: string;
};

export type EvalTurnMedia = {
  path?: string;
  storageBucket?: string;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  sourceUrl?: string;
  signedUrl?: string;
  fileSizeBytes?: number;
};

export type EvalTurn = {
  role: EvalTurnRole;
  content: string;
  media?: EvalTurnMedia | null;
  whyReply?: string | null;
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

export type EvalRunRecord = {
  id: string;
  status: EvalRunStatus;
  actualReply: string;
  answerAnalysis: string | null;
  /** Subject agent reasoning_for_operators (live chat Reasoning). */
  reasoningForOperators: string | null;
  handoffCalled: boolean;
  handoffTopicEntryId: string | null;
  /** Resolved topic title when the subject handed off with a topic id. */
  handoffTopicLabel: string | null;
  errorMessage: string | null;
  subjectSessionId: string | null;
  ranAt: string;
};

export type EvalCaseRecord = {
  id: string;
  workspaceId: string;
  agentId: string;
  agentName: string;
  title: string;
  source: EvalSource;
  status: EvalCaseStatus;
  turns: EvalTurn[];
  expectedReply: string;
  expectedAction: EvalExpectedAction;
  expectedTopicEntryId: string | null;
  /** Topic title when expectedAction is handoff (display only). */
  expectedTopicLabel: string | null;
  /** Topic description when expectedAction is handoff (display only). */
  expectedTopicDescription: string | null;
  answerAnalysis: string | null;
  answerCorrect: boolean | null;
  sourceConversationId: string | null;
  runs: EvalRunRecord[];
  createdAt: string;
  updatedAt: string;
};

export type CreateManualEvalCaseInput = {
  workspaceId: string;
  agentConfigId: string;
  title: string;
  userMessage: string;
  expectedReply: string;
};

export type CreateEvalCaseFromDraftInput = {
  workspaceId: string;
  agentConfigId: string;
  title: string;
  source: EvalSource;
  status: EvalCaseStatus;
  turns: EvalTurn[];
  expectedReply: string;
  expectedAction?: EvalExpectedAction;
  expectedTopicEntryId?: string | null;
  answerAnalysis: string | null;
  answerCorrect: boolean | null;
  sourceConversationId: string | null;
};

export type UpdateEvalCaseInput = {
  title?: string;
  status?: EvalCaseStatus;
  turns?: EvalTurn[];
  expectedReply?: string;
  expectedAction?: EvalExpectedAction;
  expectedTopicEntryId?: string | null;
  answerAnalysis?: string | null;
  answerCorrect?: boolean | null;
};

export type CreateEvalRunInput = {
  workspaceId: string;
  evalCaseId: string;
  status: EvalRunStatus;
  actualReply: string;
  answerAnalysis: string | null;
  reasoningForOperators?: string | null;
  handoffCalled?: boolean;
  handoffTopicEntryId?: string | null;
  errorMessage?: string | null;
  subjectSessionId: string | null;
};

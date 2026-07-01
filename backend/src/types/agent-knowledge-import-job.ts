import type {
  AgentKnowledgeImportDraft,
  AgentKnowledgeImportTarget,
  AgentKnowledgeImportWorkspaceRefs,
} from "./agent-knowledge-import.js";

export type AgentKnowledgeImportJobStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "dismissed";

export type AgentKnowledgeImportJobFile = {
  id: string;
  name: string;
  mimeType: string;
  storageKey: string;
};

export type AgentKnowledgeImportJobRecord = {
  id: string;
  workspace_id: string;
  agent_id: string;
  profile_name: string;
  status: AgentKnowledgeImportJobStatus;
  targets: AgentKnowledgeImportTarget[];
  focus_hint: string;
  files: AgentKnowledgeImportJobFile[];
  draft: AgentKnowledgeImportDraft | null;
  selection: unknown | null;
  workspace_refs: AgentKnowledgeImportWorkspaceRefs;
  error_message: string | null;
  queue_job_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentKnowledgeImportJobSummary = {
  id: string;
  status: AgentKnowledgeImportJobStatus;
  profile_name: string;
  file_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

import type { AgentKnowledgeImportTarget } from "@/types/agent-knowledge-import";
import type {
  AgentKnowledgeImportSelection,
  AgentKnowledgeImportWorkspaceRefs,
} from "@/types/agent-knowledge-import-selection";
import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";

export type AgentKnowledgeImportJobStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "dismissed";

export type AgentKnowledgeImportJob = {
  id: string;
  status: AgentKnowledgeImportJobStatus;
  profileName: string;
  targets: AgentKnowledgeImportTarget[];
  focusHint: string;
  fileCount: number;
  draft: AgentKnowledgeImportDraft | null;
  selection: AgentKnowledgeImportSelection | null;
  workspaceRefs: AgentKnowledgeImportWorkspaceRefs;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export const AGENT_KNOWLEDGE_IMPORT_POLL_MS = 3000;

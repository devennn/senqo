import { api } from "@/lib/api";
import type { AgentKnowledgeImportDraft, AgentKnowledgeImportTarget } from "@/types/agent-knowledge-import";
import type { AgentKnowledgeImportJob } from "@/types/agent-knowledge-import-job";
import type {
  AgentKnowledgeImportSelection,
  AgentKnowledgeImportWorkspaceRefs,
} from "@/types/agent-knowledge-import-selection";

function buildImportFormData(input: {
  profileName: string;
  targets: AgentKnowledgeImportTarget[];
  focusHint: string;
  files: File[];
}): FormData {
  const formData = new FormData();
  formData.append("profileName", input.profileName);
  formData.append("targets", JSON.stringify(input.targets));
  formData.append("focusHint", input.focusHint);
  for (const file of input.files) {
    formData.append("files", file);
  }
  return formData;
}

export async function startAgentKnowledgeImportJob(
  agentId: string,
  input: {
    profileName: string;
    targets: AgentKnowledgeImportTarget[];
    focusHint: string;
    files: File[];
  },
): Promise<{ ok: true; job: AgentKnowledgeImportJob }> {
  return api.postForm(
    `/api/user/agents/${agentId}/knowledge-import/jobs`,
    buildImportFormData(input),
  );
}

export async function listAgentKnowledgeImportJobs(
  agentId: string,
): Promise<{ jobs: AgentKnowledgeImportJob[] }> {
  return api.get(`/api/user/agents/${agentId}/knowledge-import/jobs`);
}

export async function getAgentKnowledgeImportJob(
  agentId: string,
  jobId: string,
): Promise<{ ok: true; job: AgentKnowledgeImportJob }> {
  return api.get(`/api/user/agents/${agentId}/knowledge-import/jobs/${jobId}`);
}

export async function saveAgentKnowledgeImportJobProgress(
  agentId: string,
  jobId: string,
  input: {
    draft?: AgentKnowledgeImportDraft;
    selection?: AgentKnowledgeImportSelection;
    workspaceRefs?: AgentKnowledgeImportWorkspaceRefs;
  },
): Promise<{ ok: true }> {
  return api.patch(`/api/user/agents/${agentId}/knowledge-import/jobs/${jobId}`, input);
}

export async function dismissAgentKnowledgeImportJob(
  agentId: string,
  jobId: string,
): Promise<{ ok: true }> {
  return api.post(`/api/user/agents/${agentId}/knowledge-import/jobs/${jobId}/dismiss`, {});
}

export async function applyAgentKnowledgeImport(
  agentId: string,
  input: {
    profileName: string;
    draft: AgentKnowledgeImportDraft;
    workspaceRefs?: AgentKnowledgeImportWorkspaceRefs;
    jobId?: string;
    selection?: AgentKnowledgeImportSelection;
  },
): Promise<{ ok: true; workspaceRefs: AgentKnowledgeImportWorkspaceRefs }> {
  return api.post(`/api/user/agents/${agentId}/knowledge-import/apply`, input);
}

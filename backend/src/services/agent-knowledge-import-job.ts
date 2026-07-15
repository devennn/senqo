import { validateAgentKnowledgeImportPreviewInput } from "../lib/agent-knowledge-import.js";
import { getBoss, QUEUE_AGENT_KNOWLEDGE_IMPORT } from "../lib/job-queue.js";
import { storageUpload } from "../lib/storage.js";
import {
  createAgentKnowledgeImportJob,
  dismissAgentKnowledgeImportJob,
  getAgentKnowledgeImportJobById,
  listActiveAgentKnowledgeImportJobs,
  markAgentKnowledgeImportJobFailed,
  updateAgentKnowledgeImportJobState,
} from "../repositories/agent-knowledge-import-jobs.js";
import type { AgentKnowledgeImportJobRecord } from "../types/agent-knowledge-import-job.js";
import type {
  AgentKnowledgeImportDraft,
  AgentKnowledgeImportWorkspaceRefs,
} from "../types/agent-knowledge-import.js";
import type { AgentKnowledgeImportJobPayload } from "./agent-knowledge-import-job-run.js";

const scope = "AgentKnowledgeImportJobService";
const STORAGE_BUCKET = "knowledge-imports";

function toJobResponse(job: AgentKnowledgeImportJobRecord) {
  return {
    id: job.id,
    status: job.status,
    profileName: job.profile_name,
    targets: job.targets,
    focusHint: job.focus_hint,
    fileCount: job.files.length,
    draft: job.draft,
    selection: job.selection,
    workspaceRefs: job.workspace_refs,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

export async function startAgentKnowledgeImportJob(input: {
  workspaceId: string;
  agentId: string;
  profileName: string;
  focusHint: string;
  targetsJson: string;
  files: File[];
}): Promise<
  | { ok: true; job: ReturnType<typeof toJobResponse> }
  | { ok: false; message: string; error?: "import_job_already_active"; jobId?: string }
> {
  const validated = validateAgentKnowledgeImportPreviewInput({
    targetsJson: input.targetsJson,
    files: input.files,
  });
  if (!validated.ok) return validated;

  const activeJobs = await listActiveAgentKnowledgeImportJobs(input.workspaceId, input.agentId);
  const blocking = activeJobs.find(
    (job) => job.status === "queued" || job.status === "processing" || job.status === "ready",
  );
  if (blocking) {
    console.warn(
      `[${scope}/start] Failed query: import already active agentId=${input.agentId} jobId=${blocking.id}`,
    );
    return {
      ok: false,
      error: "import_job_already_active",
      jobId: blocking.id,
      message: "An import is already in progress for this agent.",
    };
  }

  const jobId = crypto.randomUUID();
  const uploadedFiles = [];

  for (const file of input.files) {
    const fileId = crypto.randomUUID();
    const storageKey = `${input.workspaceId}/${jobId}/${fileId}-${file.name}`;
    const data = await file.arrayBuffer();
    const upload = await storageUpload(
      STORAGE_BUCKET,
      storageKey,
      data,
      file.type || "application/octet-stream",
    );
    if (upload.error) {
      return { ok: false, message: `Could not store ${file.name}.` };
    }
    uploadedFiles.push({
      id: fileId,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      storageKey,
    });
  }

  let queueJobId: string | null = null;
  const created = await createAgentKnowledgeImportJob({
    id: jobId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    profileName: input.profileName.trim(),
    targets: validated.targets,
    focusHint: input.focusHint,
    files: uploadedFiles,
    queueJobId: null,
  });

  if (!created.ok) {
    return { ok: false, message: created.message };
  }

  try {
    const payload: AgentKnowledgeImportJobPayload = { jobId: created.id };
    queueJobId = await getBoss().send(QUEUE_AGENT_KNOWLEDGE_IMPORT, payload);
  } catch (error) {
    console.error(`[${scope}/start] Unexpected error enqueue: ${String(error)}`);
    await markAgentKnowledgeImportJobFailed(created.id, "Could not queue import job.");
    return { ok: false, message: "Could not queue import job." };
  }

  if (!queueJobId) {
    await markAgentKnowledgeImportJobFailed(created.id, "Could not queue import job.");
    return { ok: false, message: "Could not queue import job." };
  }

  const job = await getAgentKnowledgeImportJobById(input.workspaceId, input.agentId, created.id);
  if (!job) {
    return { ok: false, message: "Import job not found after create." };
  }

  console.info(`[${scope}/start] Success: jobId=${created.id}`);
  return { ok: true, job: toJobResponse(job) };
}

export async function getAgentKnowledgeImportJob(
  workspaceId: string,
  agentId: string,
  jobId: string,
): Promise<{ ok: true; job: ReturnType<typeof toJobResponse> } | { ok: false; message: string }> {
  const job = await getAgentKnowledgeImportJobById(workspaceId, agentId, jobId);
  if (!job) {
    return { ok: false, message: "Import job not found." };
  }
  return { ok: true, job: toJobResponse(job) };
}

export async function listAgentKnowledgeImportJobs(
  workspaceId: string,
  agentId: string,
): Promise<{ jobs: ReturnType<typeof toJobResponse>[] }> {
  const summaries = await listActiveAgentKnowledgeImportJobs(workspaceId, agentId);
  const jobs = await Promise.all(
    summaries.map(async (summary) => {
      const full = await getAgentKnowledgeImportJobById(workspaceId, agentId, summary.id);
      return full ? toJobResponse(full) : null;
    }),
  );
  return { jobs: jobs.filter((job): job is NonNullable<typeof job> => job !== null) };
}

export async function saveAgentKnowledgeImportJobProgress(input: {
  workspaceId: string;
  agentId: string;
  jobId: string;
  draft?: AgentKnowledgeImportDraft;
  selection?: unknown;
  workspaceRefs?: AgentKnowledgeImportWorkspaceRefs;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return updateAgentKnowledgeImportJobState(input);
}

export async function dismissAgentKnowledgeImportJobForAgent(
  workspaceId: string,
  agentId: string,
  jobId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return dismissAgentKnowledgeImportJob(workspaceId, agentId, jobId);
}

import { createInitialImportSelection } from "../lib/agent-knowledge-import-selection-init.js";
import { extractAgentKnowledgeImportDocuments } from "../lib/agent-knowledge-import-extract.js";
import { storageDownload } from "../lib/storage.js";
import {
  getAgentKnowledgeImportJobForWorker,
  markAgentKnowledgeImportJobFailed,
  markAgentKnowledgeImportJobProcessing,
  markAgentKnowledgeImportJobReady,
} from "../repositories/agent-knowledge-import-jobs.js";
import { generateAgentKnowledgeImportDraft } from "./agent-knowledge-import-generate.js";
import type { AgentKnowledgeImportJobFile } from "../types/agent-knowledge-import-job.js";
import type { AgentKnowledgeImportTarget } from "../types/agent-knowledge-import.js";

const scope = "AgentKnowledgeImportJobRun";
const STORAGE_BUCKET = "knowledge-imports";

export type AgentKnowledgeImportJobPayload = {
  jobId: string;
};

export async function executeAgentKnowledgeImportJob(
  payload: AgentKnowledgeImportJobPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { jobId } = payload;

  try {
    const job = await getAgentKnowledgeImportJobForWorker(jobId);
    if (!job) {
      return { ok: false, error: "import_job_not_found" };
    }
    if (job.status === "dismissed" || job.status === "ready" || job.status === "failed") {
      return { ok: true };
    }

    const started = await markAgentKnowledgeImportJobProcessing(jobId);
    if (!started && job.status !== "processing") {
      return { ok: true };
    }

    const filePayloads = await Promise.all(
      job.files.map(async (file: AgentKnowledgeImportJobFile) => {
        const data = await storageDownload(STORAGE_BUCKET, file.storageKey);
        if (!data) {
          throw new Error(`Could not read uploaded file: ${file.name}`);
        }
        return {
          name: file.name,
          mimeType: file.mimeType,
          data: new Uint8Array(data).buffer,
        };
      }),
    );

    const extracted = await extractAgentKnowledgeImportDocuments(filePayloads);
    if (!extracted.ok) {
      await markAgentKnowledgeImportJobFailed(jobId, extracted.message);
      return { ok: false, error: extracted.message };
    }

    const draft = await generateAgentKnowledgeImportDraft({
      profileName: job.profile_name.trim(),
      targets: job.targets as AgentKnowledgeImportTarget[],
      focusHint: job.focus_hint,
      documents: extracted.documents,
    });

    const saved = await markAgentKnowledgeImportJobReady({
      jobId,
      draft,
      selection: createInitialImportSelection(draft),
    });
    if (!saved) {
      return { ok: false, error: "import_job_save_failed" };
    }

    console.info(`[${scope}/execute] Success: jobId=${jobId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process import job.";
    console.error(`[${scope}/execute] Unexpected error: ${message}`);
    await markAgentKnowledgeImportJobFailed(jobId, message);
    return { ok: false, error: message };
  }
}

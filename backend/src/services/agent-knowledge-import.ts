import { extractAgentKnowledgeImportDocuments } from "../lib/agent-knowledge-import-extract.js";
import {
  validateAgentKnowledgeImportPreviewInput,
} from "../lib/agent-knowledge-import.js";
import {
  agentKnowledgeImportApplySchema,
  type AgentKnowledgeImportDraft,
  type AgentKnowledgeImportWorkspaceRefs,
} from "../types/agent-knowledge-import.js";
import { applyAgentKnowledgeImport } from "./agent-knowledge-import-apply.js";
import { generateAgentKnowledgeImportDraft } from "./agent-knowledge-import-generate.js";
import { saveAgentKnowledgeImportJobProgress } from "./agent-knowledge-import-job.js";

const scope = "AgentKnowledgeImportService";

export type AgentKnowledgeImportPreviewInput = {
  workspaceId: string;
  agentId: string;
  profileName: string;
  focusHint: string;
  targetsJson: string;
  files: File[];
};

export type AgentKnowledgeImportApplyInput = {
  workspaceId: string;
  agentId: string;
  body: unknown;
};

export async function runAgentKnowledgeImportPreview(
  input: AgentKnowledgeImportPreviewInput,
): Promise<{ ok: true; draft: AgentKnowledgeImportDraft } | { ok: false; message: string }> {
  const validated = validateAgentKnowledgeImportPreviewInput({
    targetsJson: input.targetsJson,
    files: input.files,
  });
  if (!validated.ok) return validated;

  try {
    const filePayloads = await Promise.all(
      input.files.map(async (file) => ({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        data: await file.arrayBuffer(),
      })),
    );

    const extracted = await extractAgentKnowledgeImportDocuments(filePayloads);
    if (!extracted.ok) return extracted;

    const draft = await generateAgentKnowledgeImportDraft({
      profileName: input.profileName.trim(),
      targets: validated.targets,
      focusHint: input.focusHint,
      documents: extracted.documents,
    });

    console.info(
      `[${scope}/preview] Success: agentId=${input.agentId} files=${validated.files.length}`,
    );

    return { ok: true, draft };
  } catch (error) {
    console.error(`[${scope}/preview] Unexpected error: ${String(error)}`);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not process import preview.",
    };
  }
}

export async function runAgentKnowledgeImportApply(
  input: AgentKnowledgeImportApplyInput,
): Promise<
  { ok: true; workspaceRefs: AgentKnowledgeImportWorkspaceRefs } | { ok: false; message: string }
> {
  try {
    const parsed = agentKnowledgeImportApplySchema.safeParse(input.body);
    if (!parsed.success) {
      console.warn(`[${scope}/apply] Failed query: invalid payload`);
      return { ok: false, message: "Invalid payload." };
    }

    const result = await applyAgentKnowledgeImport({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      draft: parsed.data.draft,
      workspaceRefs: parsed.data.workspaceRefs,
    });
    if (!result.ok) {
      return result;
    }

    if (parsed.data.jobId) {
      await saveAgentKnowledgeImportJobProgress({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        jobId: parsed.data.jobId,
        draft: parsed.data.draft,
        selection: parsed.data.selection,
        workspaceRefs: result.workspaceRefs,
      });
    }

    return result;
  } catch (error) {
    console.error(`[${scope}/apply] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not process import apply." };
  }
}

import {
  agentKnowledgeImportTargetsSchema,
  type AgentKnowledgeImportTarget,
} from "../types/agent-knowledge-import.js";

export const AGENT_KNOWLEDGE_IMPORT_MAX_FILES = 5;
export const AGENT_KNOWLEDGE_IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["pdf", "csv", "md"]);

export type AgentKnowledgeImportFileMeta = {
  name: string;
  size: number;
  mimeType: string;
};

export function validateAgentKnowledgeImportFileMeta(
  file: AgentKnowledgeImportFileMeta,
): { ok: true } | { ok: false; message: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, message: `${file.name}: unsupported file type.` };
  }
  if (file.size > AGENT_KNOWLEDGE_IMPORT_MAX_FILE_BYTES) {
    return { ok: false, message: `${file.name}: exceeds 15 MB limit.` };
  }
  return { ok: true };
}

export type AgentKnowledgeImportPreviewValidationInput = {
  targetsJson: string;
  files: { name: string; size: number; type?: string }[];
};

export function validateAgentKnowledgeImportPreviewInput(
  input: AgentKnowledgeImportPreviewValidationInput,
):
  | { ok: true; targets: AgentKnowledgeImportTarget[]; files: AgentKnowledgeImportFileMeta[] }
  | { ok: false; message: string } {
  let targetsParsed: unknown;
  try {
    targetsParsed = JSON.parse(input.targetsJson || "[]");
  } catch {
    return { ok: false, message: "Invalid targets payload." };
  }

  const targets = agentKnowledgeImportTargetsSchema.safeParse(targetsParsed);
  if (!targets.success) {
    return { ok: false, message: "Select at least one import target." };
  }

  if (input.files.length === 0) {
    return { ok: false, message: "At least one file is required." };
  }
  if (input.files.length > AGENT_KNOWLEDGE_IMPORT_MAX_FILES) {
    return { ok: false, message: `You can upload up to ${AGENT_KNOWLEDGE_IMPORT_MAX_FILES} files.` };
  }

  const files: AgentKnowledgeImportFileMeta[] = input.files.map((file) => ({
    name: file.name || "document",
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  }));

  for (const meta of files) {
    const check = validateAgentKnowledgeImportFileMeta(meta);
    if (!check.ok) return { ok: false, message: check.message };
  }

  return { ok: true, targets: targets.data, files };
}

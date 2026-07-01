import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";

export const AGENT_KNOWLEDGE_IMPORT_ACCEPT = ".pdf,.csv,.md";

export const AGENT_KNOWLEDGE_IMPORT_FILE_TYPES_LABEL = "PDF, CSV, or Markdown";

export const AGENT_KNOWLEDGE_IMPORT_MAX_FILES = 5;
export const AGENT_KNOWLEDGE_IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["pdf", "csv", "md"]);

export function validateAgentKnowledgeImportFile(file: File): { ok: true } | { ok: false; message: string } {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, message: `${file.name}: unsupported file type.` };
  }
  if (file.size > AGENT_KNOWLEDGE_IMPORT_MAX_FILE_BYTES) {
    return { ok: false, message: `${file.name}: exceeds 15 MB limit.` };
  }
  return { ok: true };
}

export function countAgentKnowledgeImportDraftItems(draft: AgentKnowledgeImportDraft): {
  contextFacts: number;
  skills: number;
  templateEntries: number;
} {
  return {
    contextFacts: draft.contextGroups.reduce((sum, g) => sum + g.facts.length, 0),
    skills: draft.skills.length,
    templateEntries: draft.templateGroups.reduce((sum, g) => sum + g.entries.length, 0),
  };
}

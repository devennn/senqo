import type { AgentKnowledgeImportDraft } from "../types/agent-knowledge-import.js";

export function createInitialImportSelection(draft: AgentKnowledgeImportDraft): unknown {
  return {
    contextGroups: Object.fromEntries(
      draft.contextGroups.map((group) => [
        group.id,
        {
          disposition: "pending",
          facts: Object.fromEntries(group.facts.map((fact) => [fact.id, "pending"])),
        },
      ]),
    ),
    skills: Object.fromEntries(draft.skills.map((skill) => [skill.id, "pending"])),
    templateGroups: Object.fromEntries(
      draft.templateGroups.map((group) => [
        group.id,
        {
          disposition: "pending",
          entries: Object.fromEntries(group.entries.map((entry) => [entry.id, "pending"])),
        },
      ]),
    ),
  };
}

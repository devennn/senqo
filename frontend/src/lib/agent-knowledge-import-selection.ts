import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";
import type {
  AgentKnowledgeImportApplyTarget,
  AgentKnowledgeImportGroupDisposition,
  AgentKnowledgeImportItemDisposition,
  AgentKnowledgeImportSelection,
  AgentKnowledgeImportWorkspaceRefs,
} from "@/types/agent-knowledge-import-selection";

export function createSelectionFromDraft(draft: AgentKnowledgeImportDraft): AgentKnowledgeImportSelection {
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

export function createEmptyWorkspaceRefs(): AgentKnowledgeImportWorkspaceRefs {
  return { contextGroups: {}, templateGroups: {} };
}

function isActionable(disposition: AgentKnowledgeImportItemDisposition): boolean {
  return disposition === "pending" || disposition === "accepted";
}

export function effectiveContextFactDisposition(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
  factId: string,
): AgentKnowledgeImportItemDisposition {
  const group = selection.contextGroups[groupId];
  if (!group) return "pending";
  const fact = group.facts[factId] ?? "pending";
  if (fact === "applied") return "applied";
  if (group.disposition === "discarded" || fact === "discarded") return "discarded";
  if (group.disposition === "accepted" || fact === "accepted") return "accepted";
  return "pending";
}

export function effectiveTemplateEntryDisposition(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
  entryId: string,
): AgentKnowledgeImportItemDisposition {
  const group = selection.templateGroups[groupId];
  if (!group) return "pending";
  const entry = group.entries[entryId] ?? "pending";
  if (entry === "applied") return "applied";
  if (group.disposition === "discarded" || entry === "discarded") return "discarded";
  if (group.disposition === "accepted" || entry === "accepted") return "accepted";
  return "pending";
}

export function effectiveContextGroupDisposition(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
  groupId: string,
): AgentKnowledgeImportItemDisposition {
  const group = draft.contextGroups.find((entry) => entry.id === groupId);
  const groupSel = selection.contextGroups[groupId];
  if (!group || !groupSel) return "pending";
  if (groupSel.disposition === "discarded") return "discarded";
  const facts = group.facts.map((fact) => effectiveContextFactDisposition(selection, groupId, fact.id));
  if (facts.length > 0 && facts.every((fact) => fact === "applied")) return "applied";
  if (facts.some((fact) => fact === "accepted")) return "accepted";
  return "pending";
}

export function effectiveTemplateGroupDisposition(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
  groupId: string,
): AgentKnowledgeImportItemDisposition {
  const group = draft.templateGroups.find((entry) => entry.id === groupId);
  const groupSel = selection.templateGroups[groupId];
  if (!group || !groupSel) return "pending";
  if (groupSel.disposition === "discarded") return "discarded";
  const entries = group.entries.map((entry) =>
    effectiveTemplateEntryDisposition(selection, groupId, entry.id),
  );
  if (entries.length > 0 && entries.every((entry) => entry === "applied")) return "applied";
  if (entries.some((entry) => entry === "accepted")) return "accepted";
  return "pending";
}

export function effectiveSkillDisposition(
  selection: AgentKnowledgeImportSelection,
  skillId: string,
): AgentKnowledgeImportItemDisposition {
  return selection.skills[skillId] ?? "pending";
}

export function isImportReviewItemVisible(
  disposition: AgentKnowledgeImportItemDisposition,
  isApplying: boolean,
): boolean {
  if (disposition === "discarded" || disposition === "applied") return false;
  if (disposition === "pending") return true;
  return isApplying;
}

function isApplyingContextFact(
  applyingTarget: AgentKnowledgeImportApplyTarget | null,
  groupId: string,
  factId: string,
): boolean {
  return (
    applyingTarget?.kind === "context-fact" &&
    applyingTarget.groupId === groupId &&
    applyingTarget.factId === factId
  );
}

function isApplyingContextGroup(
  applyingTarget: AgentKnowledgeImportApplyTarget | null,
  groupId: string,
): boolean {
  return applyingTarget?.kind === "context-group" && applyingTarget.groupId === groupId;
}

function isApplyingTemplateEntry(
  applyingTarget: AgentKnowledgeImportApplyTarget | null,
  groupId: string,
  entryId: string,
): boolean {
  return (
    applyingTarget?.kind === "template-entry" &&
    applyingTarget.groupId === groupId &&
    applyingTarget.entryId === entryId
  );
}

function isApplyingTemplateGroup(
  applyingTarget: AgentKnowledgeImportApplyTarget | null,
  groupId: string,
): boolean {
  return applyingTarget?.kind === "template-group" && applyingTarget.groupId === groupId;
}

export function isImportReviewContextGroupVisible(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
  groupId: string,
  applyingTarget: AgentKnowledgeImportApplyTarget | null,
): boolean {
  const group = draft.contextGroups.find((entry) => entry.id === groupId);
  if (!group) return false;

  const groupDisposition = effectiveContextGroupDisposition(draft, selection, groupId);
  const isAddingGroup = isApplyingContextGroup(applyingTarget, groupId);
  if (groupDisposition === "discarded" || groupDisposition === "applied") return false;
  if (groupDisposition === "accepted") return isAddingGroup;

  return group.facts.some((fact) =>
    isImportReviewItemVisible(
      effectiveContextFactDisposition(selection, groupId, fact.id),
      isApplyingContextFact(applyingTarget, groupId, fact.id),
    ),
  );
}

export function isImportReviewTemplateGroupVisible(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
  groupId: string,
  applyingTarget: AgentKnowledgeImportApplyTarget | null,
): boolean {
  const group = draft.templateGroups.find((entry) => entry.id === groupId);
  if (!group) return false;

  const groupDisposition = effectiveTemplateGroupDisposition(draft, selection, groupId);
  const isAddingGroup = isApplyingTemplateGroup(applyingTarget, groupId);
  if (groupDisposition === "discarded" || groupDisposition === "applied") return false;
  if (groupDisposition === "accepted") return isAddingGroup;

  return group.entries.some((entry) =>
    isImportReviewItemVisible(
      effectiveTemplateEntryDisposition(selection, groupId, entry.id),
      isApplyingTemplateEntry(applyingTarget, groupId, entry.id),
    ),
  );
}

export function countVisibleImportReviewItems(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
  applyingTarget: AgentKnowledgeImportApplyTarget | null,
): { contextFacts: number; skills: number; templateEntries: number } {
  let contextFacts = 0;
  for (const group of draft.contextGroups) {
    if (!isImportReviewContextGroupVisible(draft, selection, group.id, applyingTarget)) continue;
    for (const fact of group.facts) {
      if (
        isImportReviewItemVisible(
          effectiveContextFactDisposition(selection, group.id, fact.id),
          isApplyingContextFact(applyingTarget, group.id, fact.id),
        )
      ) {
        contextFacts += 1;
      }
    }
  }

  const skills = draft.skills.filter((skill) =>
    isImportReviewItemVisible(
      effectiveSkillDisposition(selection, skill.id),
      applyingTarget?.kind === "skill" && applyingTarget.skillId === skill.id,
    ),
  ).length;

  let templateEntries = 0;
  for (const group of draft.templateGroups) {
    if (!isImportReviewTemplateGroupVisible(draft, selection, group.id, applyingTarget)) continue;
    for (const entry of group.entries) {
      if (
        isImportReviewItemVisible(
          effectiveTemplateEntryDisposition(selection, group.id, entry.id),
          isApplyingTemplateEntry(applyingTarget, group.id, entry.id),
        )
      ) {
        templateEntries += 1;
      }
    }
  }

  return { contextFacts, skills, templateEntries };
}

function setNonAppliedFacts(
  facts: Record<string, AgentKnowledgeImportItemDisposition>,
  disposition: AgentKnowledgeImportItemDisposition,
): Record<string, AgentKnowledgeImportItemDisposition> {
  return Object.fromEntries(
    Object.entries(facts).map(([id, value]) => [id, value === "applied" ? value : disposition]),
  );
}

export function acceptContextGroup(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
): AgentKnowledgeImportSelection {
  const group = selection.contextGroups[groupId];
  if (!group) return selection;
  return {
    ...selection,
    contextGroups: {
      ...selection.contextGroups,
      [groupId]: {
        disposition: "accepted",
        facts: setNonAppliedFacts(group.facts, "accepted"),
      },
    },
  };
}

export function discardContextGroup(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
): AgentKnowledgeImportSelection {
  const group = selection.contextGroups[groupId];
  if (!group) return selection;
  return {
    ...selection,
    contextGroups: {
      ...selection.contextGroups,
      [groupId]: {
        disposition: "discarded",
        facts: setNonAppliedFacts(group.facts, "discarded"),
      },
    },
  };
}

export function setContextFactDisposition(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
  factId: string,
  disposition: AgentKnowledgeImportGroupDisposition | AgentKnowledgeImportItemDisposition,
): AgentKnowledgeImportSelection {
  const group = selection.contextGroups[groupId];
  if (!group || group.facts[factId] === "applied") return selection;
  return {
    ...selection,
    contextGroups: {
      ...selection.contextGroups,
      [groupId]: {
        ...group,
        disposition: disposition === "discarded" || disposition === "accepted" ? "pending" : group.disposition,
        facts: { ...group.facts, [factId]: disposition as AgentKnowledgeImportItemDisposition },
      },
    },
  };
}

export function acceptTemplateGroup(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
): AgentKnowledgeImportSelection {
  const group = selection.templateGroups[groupId];
  if (!group) return selection;
  return {
    ...selection,
    templateGroups: {
      ...selection.templateGroups,
      [groupId]: {
        disposition: "accepted",
        entries: setNonAppliedFacts(group.entries, "accepted"),
      },
    },
  };
}

export function discardTemplateGroup(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
): AgentKnowledgeImportSelection {
  const group = selection.templateGroups[groupId];
  if (!group) return selection;
  return {
    ...selection,
    templateGroups: {
      ...selection.templateGroups,
      [groupId]: {
        disposition: "discarded",
        entries: setNonAppliedFacts(group.entries, "discarded"),
      },
    },
  };
}

export function setTemplateEntryDisposition(
  selection: AgentKnowledgeImportSelection,
  groupId: string,
  entryId: string,
  disposition: AgentKnowledgeImportGroupDisposition | AgentKnowledgeImportItemDisposition,
): AgentKnowledgeImportSelection {
  const group = selection.templateGroups[groupId];
  if (!group || group.entries[entryId] === "applied") return selection;
  return {
    ...selection,
    templateGroups: {
      ...selection.templateGroups,
      [groupId]: {
        ...group,
        disposition: disposition === "discarded" || disposition === "accepted" ? "pending" : group.disposition,
        entries: { ...group.entries, [entryId]: disposition as AgentKnowledgeImportItemDisposition },
      },
    },
  };
}

export function setSkillDisposition(
  selection: AgentKnowledgeImportSelection,
  skillId: string,
  disposition: AgentKnowledgeImportItemDisposition,
): AgentKnowledgeImportSelection {
  if (selection.skills[skillId] === "applied") return selection;
  return {
    ...selection,
    skills: { ...selection.skills, [skillId]: disposition },
  };
}

function filterContextGroups(
  draft: AgentKnowledgeImportDraft,
  predicate: (groupId: string, factId: string) => boolean,
): AgentKnowledgeImportDraft["contextGroups"] {
  return draft.contextGroups
    .map((group) => ({
      ...group,
      facts: group.facts.filter((fact) => predicate(group.id, fact.id)),
    }))
    .filter((group) => group.facts.length > 0);
}

function filterTemplateGroups(
  draft: AgentKnowledgeImportDraft,
  predicate: (groupId: string, entryId: string) => boolean,
): AgentKnowledgeImportDraft["templateGroups"] {
  return draft.templateGroups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => predicate(group.id, entry.id)),
    }))
    .filter((group) => group.entries.length > 0);
}

export function filterDraftForAcceptedApply(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
): AgentKnowledgeImportDraft {
  return {
    contextGroups: filterContextGroups(draft, (groupId, factId) =>
      effectiveContextFactDisposition(selection, groupId, factId) === "accepted",
    ),
    skills: draft.skills.filter(
      (skill) => effectiveSkillDisposition(selection, skill.id) === "accepted",
    ),
    templateGroups: filterTemplateGroups(draft, (groupId, entryId) =>
      effectiveTemplateEntryDisposition(selection, groupId, entryId) === "accepted",
    ),
  };
}

export function filterDraftForPendingApply(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
): AgentKnowledgeImportDraft {
  return {
    contextGroups: filterContextGroups(draft, (groupId, factId) =>
      effectiveContextFactDisposition(selection, groupId, factId) === "pending",
    ),
    skills: draft.skills.filter(
      (skill) => effectiveSkillDisposition(selection, skill.id) === "pending",
    ),
    templateGroups: filterTemplateGroups(draft, (groupId, entryId) =>
      effectiveTemplateEntryDisposition(selection, groupId, entryId) === "pending",
    ),
  };
}

export function selectionForAcceptTarget(
  selection: AgentKnowledgeImportSelection,
  target: AgentKnowledgeImportApplyTarget,
): AgentKnowledgeImportSelection {
  switch (target.kind) {
    case "context-group":
      return acceptContextGroup(selection, target.groupId);
    case "context-fact":
      return setContextFactDisposition(selection, target.groupId, target.factId, "accepted");
    case "skill":
      return setSkillDisposition(selection, target.skillId, "accepted");
    case "template-group":
      return acceptTemplateGroup(selection, target.groupId);
    case "template-entry":
      return setTemplateEntryDisposition(selection, target.groupId, target.entryId, "accepted");
  }
}

export function buildPartialDraftForTarget(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
  target: AgentKnowledgeImportApplyTarget,
): AgentKnowledgeImportDraft | null {
  switch (target.kind) {
    case "context-group": {
      const group = draft.contextGroups.find((entry) => entry.id === target.groupId);
      if (!group) return null;
      const facts = group.facts.filter(
        (fact) => effectiveContextFactDisposition(selection, group.id, fact.id) === "accepted",
      );
      return facts.length === 0 ? null : { contextGroups: [{ ...group, facts }], skills: [], templateGroups: [] };
    }
    case "context-fact": {
      const group = draft.contextGroups.find((entry) => entry.id === target.groupId);
      const fact = group?.facts.find((entry) => entry.id === target.factId);
      if (!group || !fact) return null;
      if (effectiveContextFactDisposition(selection, group.id, fact.id) !== "accepted") return null;
      return {
        contextGroups: [{ ...group, facts: [fact] }],
        skills: [],
        templateGroups: [],
      };
    }
    case "skill": {
      const skill = draft.skills.find((entry) => entry.id === target.skillId);
      if (!skill || effectiveSkillDisposition(selection, skill.id) !== "accepted") return null;
      return { contextGroups: [], skills: [skill], templateGroups: [] };
    }
    case "template-group": {
      const group = draft.templateGroups.find((entry) => entry.id === target.groupId);
      if (!group) return null;
      const entries = group.entries.filter(
        (entry) => effectiveTemplateEntryDisposition(selection, group.id, entry.id) === "accepted",
      );
      return entries.length === 0
        ? null
        : { contextGroups: [], skills: [], templateGroups: [{ ...group, entries }] };
    }
    case "template-entry": {
      const group = draft.templateGroups.find((entry) => entry.id === target.groupId);
      const entry = group?.entries.find((item) => item.id === target.entryId);
      if (!group || !entry) return null;
      if (effectiveTemplateEntryDisposition(selection, group.id, entry.id) !== "accepted") return null;
      return {
        contextGroups: [],
        skills: [],
        templateGroups: [{ ...group, entries: [entry] }],
      };
    }
  }
}

export function countAcceptedItems(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
): number {
  const filtered = filterDraftForAcceptedApply(draft, selection);
  return countDraftItems(filtered);
}

export function countPendingItems(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
): number {
  const filtered = filterDraftForPendingApply(draft, selection);
  return countDraftItems(filtered);
}

function countDraftItems(draft: AgentKnowledgeImportDraft): number {
  return (
    draft.contextGroups.reduce((sum, group) => sum + group.facts.length, 0) +
    draft.skills.length +
    draft.templateGroups.reduce((sum, group) => sum + group.entries.length, 0)
  );
}

export function markSelectionApplied(
  selection: AgentKnowledgeImportSelection,
  appliedDraft: AgentKnowledgeImportDraft,
): AgentKnowledgeImportSelection {
  let next = selection;

  for (const group of appliedDraft.contextGroups) {
    for (const fact of group.facts) {
      const current = next.contextGroups[group.id];
      if (!current) continue;
      next = {
        ...next,
        contextGroups: {
          ...next.contextGroups,
          [group.id]: {
            ...current,
            facts: { ...current.facts, [fact.id]: "applied" },
          },
        },
      };
    }
  }

  for (const skill of appliedDraft.skills) {
    next = {
      ...next,
      skills: { ...next.skills, [skill.id]: "applied" },
    };
  }

  for (const group of appliedDraft.templateGroups) {
    for (const entry of group.entries) {
      const current = next.templateGroups[group.id];
      if (!current) continue;
      next = {
        ...next,
        templateGroups: {
          ...next.templateGroups,
          [group.id]: {
            ...current,
            entries: { ...current.entries, [entry.id]: "applied" },
          },
        },
      };
    }
  }

  return next;
}

export function mergeWorkspaceRefs(
  current: AgentKnowledgeImportWorkspaceRefs,
  incoming: AgentKnowledgeImportWorkspaceRefs,
): AgentKnowledgeImportWorkspaceRefs {
  return {
    contextGroups: { ...current.contextGroups, ...incoming.contextGroups },
    templateGroups: { ...current.templateGroups, ...incoming.templateGroups },
  };
}

export function isImportReviewComplete(
  draft: AgentKnowledgeImportDraft,
  selection: AgentKnowledgeImportSelection,
): boolean {
  for (const group of draft.contextGroups) {
    for (const fact of group.facts) {
      if (isActionable(effectiveContextFactDisposition(selection, group.id, fact.id))) {
        return false;
      }
    }
  }
  for (const skill of draft.skills) {
    if (isActionable(effectiveSkillDisposition(selection, skill.id))) {
      return false;
    }
  }
  for (const group of draft.templateGroups) {
    for (const entry of group.entries) {
      if (isActionable(effectiveTemplateEntryDisposition(selection, group.id, entry.id))) {
        return false;
      }
    }
  }
  return true;
}

export function isEmptyDraft(draft: AgentKnowledgeImportDraft): boolean {
  return (
    draft.contextGroups.length === 0 &&
    draft.skills.length === 0 &&
    draft.templateGroups.length === 0
  );
}

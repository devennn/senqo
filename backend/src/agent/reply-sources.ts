const KINDS = ["context", "template", "skill", "handoff"] as const;
type KnowledgeKind = (typeof KINDS)[number];

export type KnowledgeCatalogItem = {
  kind: KnowledgeKind;
  label: string;
  /** Parent group display name. Null for skills and for group-level items. */
  groupLabel: string | null;
  id: string;
  groupId: string | null;
};

export type AgentReplySource = {
  kind: KnowledgeKind;
  label: string;
  /** Parent group name, so chips can show group plus item. Absent for group-level refs. */
  groupLabel?: string;
  id?: string;
  groupId?: string;
};

export type AgentKnowledgeSourceCatalog = {
  items: KnowledgeCatalogItem[];
  handoffByEntryId: Record<string, KnowledgeCatalogItem>;
};

export function emptyKnowledgeSourceCatalog(): AgentKnowledgeSourceCatalog {
  return {
    items: [],
    handoffByEntryId: {},
  };
}

function isKnowledgeKind(value: unknown): value is KnowledgeKind {
  return (
    value === "context" ||
    value === "template" ||
    value === "skill" ||
    value === "handoff"
  );
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Resolve the specific item the model named. Scoping by group disambiguates entries that
 * share a title across groups; entry-level items win over group-level ones so the chip can
 * deep-link to an expanded entry.
 */
function findItem(
  catalog: AgentKnowledgeSourceCatalog,
  kind: KnowledgeKind,
  label: string,
  group = "",
): KnowledgeCatalogItem | null {
  const needle = normalizeLabel(label);
  if (!needle) return null;
  const matches = catalog.items.filter(
    (item) => item.kind === kind && normalizeLabel(item.label) === needle,
  );
  if (matches.length === 0) return null;
  const groupNeedle = normalizeLabel(group);
  if (groupNeedle) {
    const inGroup = matches.find(
      (item) => normalizeLabel(item.groupLabel ?? "") === groupNeedle,
    );
    if (inGroup) return inGroup;
  }
  return matches.find((item) => item.groupLabel !== null) ?? matches[0];
}

/** Group-level item, so a ref we cannot pin to an entry still links to its group. */
function findGroupItem(
  catalog: AgentKnowledgeSourceCatalog,
  kind: KnowledgeKind,
  group: string,
): KnowledgeCatalogItem | null {
  const needle = normalizeLabel(group);
  if (!needle) return null;
  return (
    catalog.items.find(
      (item) =>
        item.kind === kind &&
        item.groupLabel === null &&
        normalizeLabel(item.label) === needle,
    ) ?? null
  );
}

type ModelSource = { kind: KnowledgeKind; group: string; label: string };

function parseModelSources(raw: unknown): ModelSource[] {
  if (!Array.isArray(raw)) return [];
  const sources: ModelSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!isKnowledgeKind(row.kind) || !label) continue;
    const group = typeof row.group === "string" ? row.group.trim() : "";
    sources.push({ kind: row.kind, group, label });
  }
  return sources;
}

function toReplySource(item: KnowledgeCatalogItem): AgentReplySource {
  return {
    kind: item.kind,
    label: item.label,
    ...(item.groupLabel ? { groupLabel: item.groupLabel } : {}),
    id: item.id,
    ...(item.groupId ? { groupId: item.groupId } : {}),
  };
}

function pushUnique(out: AgentReplySource[], ref: AgentReplySource): void {
  const keyOf = (r: AgentReplySource) =>
    `${r.kind}:${normalizeLabel(r.groupLabel ?? "")}:${normalizeLabel(r.label)}`;
  const key = keyOf(ref);
  if (out.some((existing) => keyOf(existing) === key)) return;
  out.push(ref);
}

/** Filter model-declared refs against attached knowledge; always include loaded skills and handoff. */
export function resolveAgentReplySources(input: {
  modelSources: unknown;
  loadedSkillNames: string[];
  handoffTopicLabel: string | null;
  catalog: AgentKnowledgeSourceCatalog;
}): AgentReplySource[] {
  const resolved: AgentReplySource[] = [];

  for (const ref of parseModelSources(input.modelSources)) {
    const item =
      findItem(input.catalog, ref.kind, ref.label, ref.group) ??
      // Model named a real group but an entry we cannot match: link the group.
      findGroupItem(input.catalog, ref.kind, ref.group) ??
      // Model put the group name in `label` and left `group` empty.
      findGroupItem(input.catalog, ref.kind, ref.label);
    if (item) pushUnique(resolved, toReplySource(item));
  }

  for (const name of input.loadedSkillNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const item = findItem(input.catalog, "skill", trimmed);
    if (item) {
      pushUnique(resolved, toReplySource(item));
    } else {
      pushUnique(resolved, { kind: "skill", label: trimmed });
    }
  }

  const handoff = input.handoffTopicLabel?.trim();
  if (handoff) {
    const item = findItem(input.catalog, "handoff", handoff);
    if (item) {
      pushUnique(resolved, toReplySource(item));
    } else {
      pushUnique(resolved, { kind: "handoff", label: handoff });
    }
  }

  return resolved;
}

export function resolveHandoffTopicLabel(
  topicEntryId: string | null,
  catalog: AgentKnowledgeSourceCatalog,
  handoffCalled: boolean,
): string | null {
  if (!handoffCalled) return null;
  if (topicEntryId) {
    const fromId = catalog.handoffByEntryId[topicEntryId]?.label.trim();
    if (fromId) return fromId;
  }
  return "Human handoff";
}

/** True when the model claimed knowledge use but catalog resolve left no refs. */
export function needsKnowledgeSourcesRegen(
  knowledgeUsed: boolean,
  replySources: AgentReplySource[],
): boolean {
  return knowledgeUsed && replySources.length === 0;
}

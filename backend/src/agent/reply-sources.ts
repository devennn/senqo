import type { AgentKnowledgeRef } from "./agent-output-schema.js";

const KINDS = ["context", "template", "skill", "handoff"] as const;
type KnowledgeKind = (typeof KINDS)[number];

export type KnowledgeCatalogItem = {
  kind: KnowledgeKind;
  label: string;
  id: string;
  groupId: string | null;
};

export type AgentReplySource = AgentKnowledgeRef & {
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

function findCatalogItem(
  catalog: AgentKnowledgeSourceCatalog,
  kind: KnowledgeKind,
  label: string,
): KnowledgeCatalogItem | null {
  const needle = normalizeLabel(label);
  if (!needle) return null;
  return catalog.items.find((item) => item.kind === kind && normalizeLabel(item.label) === needle) ?? null;
}

function parseModelSources(raw: unknown): AgentKnowledgeRef[] {
  if (!Array.isArray(raw)) return [];
  const sources: AgentKnowledgeRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!isKnowledgeKind(row.kind) || !label) continue;
    sources.push({ kind: row.kind, label });
  }
  return sources;
}

function toReplySource(item: KnowledgeCatalogItem): AgentReplySource {
  return {
    kind: item.kind,
    label: item.label,
    id: item.id,
    ...(item.groupId ? { groupId: item.groupId } : {}),
  };
}

function pushUnique(out: AgentReplySource[], ref: AgentReplySource): void {
  const key = `${ref.kind}:${normalizeLabel(ref.label)}`;
  if (out.some((existing) => `${existing.kind}:${normalizeLabel(existing.label)}` === key)) {
    return;
  }
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
    const item = findCatalogItem(input.catalog, ref.kind, ref.label);
    if (item) pushUnique(resolved, toReplySource(item));
  }

  for (const name of input.loadedSkillNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const item = findCatalogItem(input.catalog, "skill", trimmed);
    if (item) {
      pushUnique(resolved, toReplySource(item));
    } else {
      pushUnique(resolved, { kind: "skill", label: trimmed });
    }
  }

  const handoff = input.handoffTopicLabel?.trim();
  if (handoff) {
    const item = findCatalogItem(input.catalog, "handoff", handoff);
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

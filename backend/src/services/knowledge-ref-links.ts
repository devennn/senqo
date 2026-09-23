import { getWorkspaceSkillById } from "../repositories/skills.js";
import {
  getWorkspaceContextEntryForEval,
  getWorkspaceContextGroupDetail,
} from "../repositories/workspace-context-groups.js";
import {
  getWorkspaceResponseTemplateEntryForEval,
  getWorkspaceResponseTemplateGroupDetail,
} from "../repositories/response-templates.js";
import {
  getWorkspaceHandoffTopicEntryForEval,
  getWorkspaceHandoffTopicGroupDetail,
} from "../repositories/handoff-topic-groups.js";

export type KnowledgeRefKind = "context" | "template" | "skill" | "handoff";

export type KnowledgeRefLinkInput = {
  kind: KnowledgeRefKind;
  id: string;
  groupId?: string | null;
};

export type KnowledgeRefLink = {
  kind: KnowledgeRefKind;
  id: string;
  href: string | null;
};

function isEntryRef(ref: KnowledgeRefLinkInput): boolean {
  return Boolean(ref.groupId && ref.groupId !== ref.id);
}

/** Build Knowledge / Agent dashboard path that opens the group and expands the entry when present. */
export function knowledgeRefHref(ref: KnowledgeRefLinkInput): string {
  if (ref.kind === "skill") {
    return `/agent?tab=skills&skillId=${encodeURIComponent(ref.id)}`;
  }
  if (ref.kind === "context") {
    const params = new URLSearchParams();
    params.set("tab", "context");
    if (isEntryRef(ref) && ref.groupId) {
      params.set("contextGroupId", ref.groupId);
      params.set("contextEntryId", ref.id);
    } else {
      params.set("contextGroupId", ref.id);
    }
    return `/knowledge?${params.toString()}`;
  }
  if (ref.kind === "template") {
    const params = new URLSearchParams();
    params.set("tab", "templates");
    if (isEntryRef(ref) && ref.groupId) {
      params.set("templateGroupId", ref.groupId);
      params.set("templateEntryId", ref.id);
    } else {
      params.set("templateGroupId", ref.id);
    }
    return `/knowledge?${params.toString()}`;
  }
  const params = new URLSearchParams();
  params.set("tab", "handoff");
  if (isEntryRef(ref) && ref.groupId) {
    params.set("handoffGroupId", ref.groupId);
    params.set("handoffEntryId", ref.id);
  } else {
    params.set("handoffGroupId", ref.id);
  }
  return `/knowledge?${params.toString()}`;
}

async function resolveContextHref(
  workspaceId: string,
  id: string,
): Promise<string | null> {
  const entry = await getWorkspaceContextEntryForEval(workspaceId, id);
  if (entry) {
    return knowledgeRefHref({
      kind: "context",
      id: entry.id,
      groupId: entry.groupId,
    });
  }
  const group = await getWorkspaceContextGroupDetail(workspaceId, id);
  if (!group) return null;
  return knowledgeRefHref({ kind: "context", id: group.id, groupId: group.id });
}

async function resolveTemplateHref(
  workspaceId: string,
  id: string,
): Promise<string | null> {
  const entry = await getWorkspaceResponseTemplateEntryForEval(workspaceId, id);
  if (entry) {
    return knowledgeRefHref({
      kind: "template",
      id: entry.id,
      groupId: entry.groupId,
    });
  }
  const group = await getWorkspaceResponseTemplateGroupDetail(workspaceId, id);
  if (!group) return null;
  return knowledgeRefHref({ kind: "template", id: group.id, groupId: group.id });
}

async function resolveHandoffHref(
  workspaceId: string,
  id: string,
): Promise<string | null> {
  const entry = await getWorkspaceHandoffTopicEntryForEval(workspaceId, id);
  if (entry) {
    return knowledgeRefHref({
      kind: "handoff",
      id: entry.id,
      groupId: entry.groupId,
    });
  }
  const group = await getWorkspaceHandoffTopicGroupDetail(workspaceId, id);
  if (!group) return null;
  return knowledgeRefHref({ kind: "handoff", id: group.id, groupId: group.id });
}

export async function resolveKnowledgeRefLinks(
  workspaceId: string,
  refs: KnowledgeRefLinkInput[],
): Promise<KnowledgeRefLink[]> {
  const links: KnowledgeRefLink[] = [];
  for (const ref of refs) {
    const id = ref.id.trim();
    if (!id) {
      links.push({ kind: ref.kind, id: ref.id, href: null });
      continue;
    }
    if (ref.kind === "skill") {
      const skill = await getWorkspaceSkillById(workspaceId, id);
      links.push({
        kind: ref.kind,
        id,
        href: skill ? knowledgeRefHref({ kind: "skill", id }) : null,
      });
      continue;
    }
    if (ref.kind === "context") {
      links.push({ kind: ref.kind, id, href: await resolveContextHref(workspaceId, id) });
      continue;
    }
    if (ref.kind === "template") {
      links.push({ kind: ref.kind, id, href: await resolveTemplateHref(workspaceId, id) });
      continue;
    }
    links.push({ kind: ref.kind, id, href: await resolveHandoffHref(workspaceId, id) });
  }
  return links;
}

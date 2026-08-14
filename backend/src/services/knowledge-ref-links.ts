import { getWorkspaceSkillById } from "../repositories/skills.js";
import {
  getWorkspaceContextEntryForEval,
  getWorkspaceContextGroupDetail,
} from "../repositories/workspace-context-groups.js";
import {
  getWorkspaceResponseTemplateEntryForEval,
  getWorkspaceResponseTemplateGroupDetail,
} from "../repositories/response-templates.js";
import { getWorkspaceHandoffTopicGroupDetail } from "../repositories/handoff-topic-groups.js";

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

export function knowledgeRefHref(ref: KnowledgeRefLinkInput): string {
  if (ref.kind === "skill") {
    return `/agent?tab=skills&skillId=${encodeURIComponent(ref.id)}`;
  }
  if (ref.kind === "context") {
    const params = new URLSearchParams();
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

async function knowledgeRefExists(
  workspaceId: string,
  ref: KnowledgeRefLinkInput,
): Promise<boolean> {
  if (ref.kind === "skill") {
    const skill = await getWorkspaceSkillById(workspaceId, ref.id);
    return skill !== null;
  }
  if (ref.kind === "context") {
    if (isEntryRef(ref)) {
      const entry = await getWorkspaceContextEntryForEval(workspaceId, ref.id);
      return entry !== null;
    }
    const group = await getWorkspaceContextGroupDetail(workspaceId, ref.id);
    return group !== null;
  }
  if (ref.kind === "template") {
    if (isEntryRef(ref)) {
      const entry = await getWorkspaceResponseTemplateEntryForEval(workspaceId, ref.id);
      return entry !== null;
    }
    const group = await getWorkspaceResponseTemplateGroupDetail(workspaceId, ref.id);
    return group !== null;
  }
  const groupId = isEntryRef(ref) ? ref.groupId : ref.id;
  if (!groupId) return false;
  const group = await getWorkspaceHandoffTopicGroupDetail(workspaceId, groupId);
  if (!group) return false;
  if (!isEntryRef(ref)) return true;
  return group.entries.some((entry) => entry.id === ref.id);
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
    const exists = await knowledgeRefExists(workspaceId, { ...ref, id });
    links.push({
      kind: ref.kind,
      id,
      href: exists ? knowledgeRefHref({ ...ref, id }) : null,
    });
  }
  return links;
}

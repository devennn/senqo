import { eq, and, inArray, sql, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaceResponseTemplateGroups,
  workspaceResponseTemplateEntries,
  agentConfigs,
  workspaces,
} from "../db/schema/index.js";
import type {
  WorkspaceResponseTemplateEntryRecord,
  WorkspaceResponseTemplateGroupSummary,
  WorkspaceResponseTemplateGroupWithEntries,
} from "../types/repositories.js";

const scope = "ResponseTemplatesRepository";

export const RESPONSE_TEMPLATE_GROUP_NAME_MAX_LEN = 120;
export const RESPONSE_TEMPLATE_GROUPS_MAX_WORKSPACE = 40;
export const RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP = 50;
export const RESPONSE_TEMPLATE_QUESTION_MAX_LEN = 1000;
export const RESPONSE_TEMPLATE_ANSWER_MAX_LEN = 4000;

function validateTrimmedPair(
  questionText: string,
  answerText: string,
): { ok: true; q: string; a: string } | { ok: false; message: string } {
  const q = questionText.trim();
  const a = answerText.trim();

  if (q.length === 0 || a.length === 0) {
    return { ok: false, message: "Question and answer are required." };
  }
  if (q.length > RESPONSE_TEMPLATE_QUESTION_MAX_LEN) {
    return {
      ok: false,
      message: `Question is too long (max ${RESPONSE_TEMPLATE_QUESTION_MAX_LEN} characters).`,
    };
  }
  if (a.length > RESPONSE_TEMPLATE_ANSWER_MAX_LEN) {
    return {
      ok: false,
      message: `Answer is too long (max ${RESPONSE_TEMPLATE_ANSWER_MAX_LEN} characters).`,
    };
  }

  return { ok: true, q, a };
}

export async function updateWorkspaceResponseTemplateGroupName(payload: {
  workspaceId: string;
  groupId: string;
  name: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const nameTrimmed = payload.name.trim();
  if (nameTrimmed.length === 0) {
    return { ok: false, message: "Group name is required." };
  }
  if (nameTrimmed.length > RESPONSE_TEMPLATE_GROUP_NAME_MAX_LEN) {
    return {
      ok: false,
      message: `Group name is too long (max ${RESPONSE_TEMPLATE_GROUP_NAME_MAX_LEN} characters).`,
    };
  }

  try {
    await db
      .update(workspaceResponseTemplateGroups)
      .set({ name: nameTrimmed, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceResponseTemplateGroups.id, payload.groupId),
        ),
      );

    console.info(`[${scope}/updateWorkspaceResponseTemplateGroupName] Success: workspaceId=${payload.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceResponseTemplateGroupName] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function addWorkspaceResponseTemplateEntry(payload: {
  workspaceId: string;
  groupId: string;
  questionText: string;
  answerText: string;
}): Promise<{ ok: true; entry: WorkspaceResponseTemplateEntryRecord } | { ok: false; message: string }> {
  const v = validateTrimmedPair(payload.questionText, payload.answerText);
  if (!v.ok) return v;

  try {
    const [groupCheck] = await db
      .select({ id: workspaceResponseTemplateGroups.id })
      .from(workspaceResponseTemplateGroups)
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceResponseTemplateGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(`[${scope}/addWorkspaceResponseTemplateEntry] Failed query: group not found`);
      return { ok: false, message: "Group not found." };
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceResponseTemplateEntries)
      .where(eq(workspaceResponseTemplateEntries.groupId, payload.groupId));

    const entryCount = row?.count ?? 0;

    if (entryCount >= RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP) {
      return {
        ok: false,
        message: `At most ${RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP} entries per group.`,
      };
    }

    const [maxRow] = await db
      .select({ sortOrder: workspaceResponseTemplateEntries.sortOrder })
      .from(workspaceResponseTemplateEntries)
      .where(eq(workspaceResponseTemplateEntries.groupId, payload.groupId))
      .orderBy(sql`${workspaceResponseTemplateEntries.sortOrder} desc`)
      .limit(1);

    const nextSort = (maxRow?.sortOrder ?? -1) + 1;

    const [inserted] = await db
      .insert(workspaceResponseTemplateEntries)
      .values({
        groupId: payload.groupId,
        sortOrder: nextSort,
        title: v.q,
        body: v.a,
      })
      .returning({
        id: workspaceResponseTemplateEntries.id,
        sortOrder: workspaceResponseTemplateEntries.sortOrder,
        title: workspaceResponseTemplateEntries.title,
        body: workspaceResponseTemplateEntries.body,
      });

    if (!inserted) {
      console.error(`[${scope}/addWorkspaceResponseTemplateEntry] Failed query: no row`);
      return { ok: false, message: "Insert failed." };
    }

    console.info(`[${scope}/addWorkspaceResponseTemplateEntry] Success: workspaceId=${payload.workspaceId}`);
    return {
      ok: true,
      entry: {
        id: inserted.id,
        sort_order: inserted.sortOrder,
        question_text: inserted.title,
        answer_text: inserted.body,
      },
    };
  } catch (error) {
    console.error(`[${scope}/addWorkspaceResponseTemplateEntry] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateWorkspaceResponseTemplateEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
  questionText: string;
  answerText: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = validateTrimmedPair(payload.questionText, payload.answerText);
  if (!v.ok) return v;

  try {
    const [groupCheck] = await db
      .select({ id: workspaceResponseTemplateGroups.id })
      .from(workspaceResponseTemplateGroups)
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceResponseTemplateGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(`[${scope}/updateWorkspaceResponseTemplateEntry] Failed query: entry not found`);
      return { ok: false, message: "Template not found." };
    }

    const [entryRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceResponseTemplateEntries)
      .where(
        and(
          eq(workspaceResponseTemplateEntries.groupId, payload.groupId),
          eq(workspaceResponseTemplateEntries.id, payload.entryId),
        ),
      );

    if ((entryRow?.count ?? 0) !== 1) {
      console.error(`[${scope}/updateWorkspaceResponseTemplateEntry] Failed query: entry not found`);
      return { ok: false, message: "Template not found." };
    }

    await db
      .update(workspaceResponseTemplateEntries)
      .set({ title: v.q, body: v.a })
      .where(
        and(
          eq(workspaceResponseTemplateEntries.groupId, payload.groupId),
          eq(workspaceResponseTemplateEntries.id, payload.entryId),
        ),
      );

    await db
      .update(workspaceResponseTemplateGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceResponseTemplateGroups.id, payload.groupId),
        ),
      );

    console.info(`[${scope}/updateWorkspaceResponseTemplateEntry] Success: workspaceId=${payload.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceResponseTemplateEntry] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceResponseTemplateEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [groupCheck] = await db
      .select({ id: workspaceResponseTemplateGroups.id })
      .from(workspaceResponseTemplateGroups)
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceResponseTemplateGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(`[${scope}/deleteWorkspaceResponseTemplateEntry] Failed query: group not found`);
      return { ok: false, message: "Group not found." };
    }

    await db
      .delete(workspaceResponseTemplateEntries)
      .where(
        and(
          eq(workspaceResponseTemplateEntries.groupId, payload.groupId),
          eq(workspaceResponseTemplateEntries.id, payload.entryId),
        ),
      );

    await db
      .update(workspaceResponseTemplateGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceResponseTemplateGroups.id, payload.groupId),
        ),
      );

    console.info(`[${scope}/deleteWorkspaceResponseTemplateEntry] Success: workspaceId=${payload.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceResponseTemplateEntry] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function listWorkspaceResponseTemplateGroupSummaries(
  workspaceId: string,
): Promise<WorkspaceResponseTemplateGroupSummary[]> {
  try {
    const groups = await db
      .select({
        id: workspaceResponseTemplateGroups.id,
        name: workspaceResponseTemplateGroups.name,
        updatedAt: workspaceResponseTemplateGroups.updatedAt,
      })
      .from(workspaceResponseTemplateGroups)
      .where(eq(workspaceResponseTemplateGroups.workspaceId, workspaceId))
      .orderBy(sql`${workspaceResponseTemplateGroups.name} asc`);

    if (groups.length === 0) {
      console.info(`[${scope}/listWorkspaceResponseTemplateGroupSummaries] Success: workspaceId=${workspaceId}`);
      return [];
    }

    const groupIds = groups.map((g) => g.id);

    const counts = await db
      .select({ groupId: workspaceResponseTemplateEntries.groupId })
      .from(workspaceResponseTemplateEntries)
      .where(inArray(workspaceResponseTemplateEntries.groupId, groupIds));

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.groupId, (countMap.get(row.groupId) ?? 0) + 1);
    }

    console.info(`[${scope}/listWorkspaceResponseTemplateGroupSummaries] Success: workspaceId=${workspaceId}`);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      updated_at: g.updatedAt.toISOString(),
      entry_count: countMap.get(g.id) ?? 0,
    }));
  } catch (error) {
    console.error(`[${scope}/listWorkspaceResponseTemplateGroupSummaries] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getWorkspaceResponseTemplateGroupDetail(
  workspaceId: string,
  groupId: string,
): Promise<WorkspaceResponseTemplateGroupWithEntries | null> {
  try {
    const [group] = await db
      .select({
        id: workspaceResponseTemplateGroups.id,
        name: workspaceResponseTemplateGroups.name,
        updatedAt: workspaceResponseTemplateGroups.updatedAt,
      })
      .from(workspaceResponseTemplateGroups)
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, workspaceId),
          eq(workspaceResponseTemplateGroups.id, groupId),
        ),
      )
      .limit(1);

    if (!group) {
      console.error(`[${scope}/getWorkspaceResponseTemplateGroupDetail] Failed query: group not found`);
      return null;
    }

    const entries = await db
      .select({
        id: workspaceResponseTemplateEntries.id,
        sortOrder: workspaceResponseTemplateEntries.sortOrder,
        title: workspaceResponseTemplateEntries.title,
        body: workspaceResponseTemplateEntries.body,
      })
      .from(workspaceResponseTemplateEntries)
      .where(eq(workspaceResponseTemplateEntries.groupId, groupId))
      .orderBy(sql`${workspaceResponseTemplateEntries.sortOrder} asc`);

    console.info(`[${scope}/getWorkspaceResponseTemplateGroupDetail] Success: workspaceId=${workspaceId}`);
    return {
      id: group.id,
      name: group.name,
      updated_at: group.updatedAt.toISOString(),
      entries: entries.map((e) => ({
        id: e.id,
        sort_order: e.sortOrder,
        question_text: e.title,
        answer_text: e.body,
      })),
    };
  } catch (error) {
    console.error(`[${scope}/getWorkspaceResponseTemplateGroupDetail] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createWorkspaceResponseTemplateGroup(
  workspaceId: string,
  nameTrimmed: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceResponseTemplateGroups)
      .where(eq(workspaceResponseTemplateGroups.workspaceId, workspaceId));

    const count = row?.count ?? 0;

    if (count >= RESPONSE_TEMPLATE_GROUPS_MAX_WORKSPACE) {
      return { ok: false, message: `At most ${RESPONSE_TEMPLATE_GROUPS_MAX_WORKSPACE} groups per workspace.` };
    }

    const [inserted] = await db
      .insert(workspaceResponseTemplateGroups)
      .values({ workspaceId, name: nameTrimmed })
      .returning({ id: workspaceResponseTemplateGroups.id });

    if (!inserted) {
      console.error(`[${scope}/createWorkspaceResponseTemplateGroup] Failed query: insert returned no row`);
      return { ok: false, message: "Insert failed." };
    }

    console.info(`[${scope}/createWorkspaceResponseTemplateGroup] Success: workspaceId=${workspaceId}`);
    return { ok: true, id: inserted.id };
  } catch (error) {
    console.error(`[${scope}/createWorkspaceResponseTemplateGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceResponseTemplateGroup(
  workspaceId: string,
  groupId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await stripResponseTemplateGroupIdFromAgents(workspaceId, groupId);

    await db
      .delete(workspaceResponseTemplateGroups)
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, workspaceId),
          eq(workspaceResponseTemplateGroups.id, groupId),
        ),
      );

    console.info(`[${scope}/deleteWorkspaceResponseTemplateGroup] Success: workspaceId=${workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceResponseTemplateGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

async function stripResponseTemplateGroupIdFromAgents(workspaceId: string, groupId: string): Promise<void> {
  const { listAgentConfigs } = await import("./agent.js");
  const agents = await listAgentConfigs(workspaceId);

  for (const agent of agents) {
    const current = normalizeResponseTemplateGroupIds(agent.response_template_groups);
    if (!current.includes(groupId)) continue;

    const next = current.filter((id) => id !== groupId);

    try {
      await db
        .update(agentConfigs)
        .set({ responseTemplateGroups: next })
        .where(
          and(
            eq(agentConfigs.id, agent.id),
            eq(agentConfigs.workspaceId, workspaceId),
            isNull(agentConfigs.archivedAt),
          ),
        );
    } catch (error) {
      console.error(`[${scope}/stripResponseTemplateGroupIdFromAgents] Failed query: ${String(error)}`);
    }
  }

  console.info(`[${scope}/stripResponseTemplateGroupIdFromAgents] Success: workspaceId=${workspaceId}`);
}

export async function validateResponseTemplateGroupIdsForWorkspace(
  workspaceId: string,
  ids: string[],
): Promise<{ ok: true; normalized: string[] } | { ok: false; message: string }> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) {
    return { ok: true, normalized: [] };
  }

  try {
    const data = await db
      .select({ id: workspaceResponseTemplateGroups.id })
      .from(workspaceResponseTemplateGroups)
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, workspaceId),
          inArray(workspaceResponseTemplateGroups.id, unique),
        ),
      );

    const found = new Set(data.map((r) => r.id));
    for (const id of unique) {
      if (!found.has(id)) {
        return { ok: false, message: "Unknown response template group." };
      }
    }

    console.info(`[${scope}/validateResponseTemplateGroupIdsForWorkspace] Success: workspaceId=${workspaceId}`);
    return { ok: true, normalized: unique };
  } catch (error) {
    console.error(`[${scope}/validateResponseTemplateGroupIdsForWorkspace] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export type ResponseTemplateGroupForInstructions = {
  name: string;
  entries: { question_text: string; answer_text: string }[];
};

/** Ordered list of attached groups + entries for prompt injection */
export async function listResponseTemplatesForInstructions(
  workspaceId: string,
  groupIds: string[],
): Promise<ResponseTemplateGroupForInstructions[]> {
  if (groupIds.length === 0) return [];

  try {
    const groups = await db
      .select({
        id: workspaceResponseTemplateGroups.id,
        name: workspaceResponseTemplateGroups.name,
      })
      .from(workspaceResponseTemplateGroups)
      .where(
        and(
          eq(workspaceResponseTemplateGroups.workspaceId, workspaceId),
          inArray(workspaceResponseTemplateGroups.id, groupIds),
        ),
      );

    if (groups.length === 0) {
      return [];
    }

    const entries = await db
      .select({
        groupId: workspaceResponseTemplateEntries.groupId,
        title: workspaceResponseTemplateEntries.title,
        body: workspaceResponseTemplateEntries.body,
        sortOrder: workspaceResponseTemplateEntries.sortOrder,
      })
      .from(workspaceResponseTemplateEntries)
      .where(inArray(workspaceResponseTemplateEntries.groupId, groupIds));

    const byGroup = new Map<string, typeof entries>();
    for (const row of entries) {
      const bucket = byGroup.get(row.groupId) ?? [];
      bucket.push(row);
      byGroup.set(row.groupId, bucket);
    }

    const result: ResponseTemplateGroupForInstructions[] = [];
    const idToName = new Map(groups.map((x) => [x.id, x.name]));

    for (const gid of groupIds) {
      const name = idToName.get(gid);
      if (!name) continue;

      const rowsByGroup = (byGroup.get(gid) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

      result.push({
        name,
        entries: rowsByGroup.map((x) => ({
          question_text: x.title,
          answer_text: x.body,
        })),
      });
    }

    console.info(`[${scope}/listResponseTemplatesForInstructions] Success: workspaceId=${workspaceId}`);
    return result;
  } catch (error) {
    console.error(`[${scope}/listResponseTemplatesForInstructions] Unexpected error: ${String(error)}`);
    return [];
  }
}

export function normalizeResponseTemplateGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}
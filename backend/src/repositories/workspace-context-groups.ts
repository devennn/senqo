import { eq, and, inArray, sql, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaceContextGroups,
  workspaceContextEntries,
  agentConfigs,
  workspaces,
} from "../db/schema/index.js";
import type {
  WorkspaceContextEntryRecord,
  WorkspaceContextGroupSummary,
  WorkspaceContextGroupWithEntries,
} from "../types/repositories.js";

const scope = "WorkspaceContextGroupsRepository";

export const CONTEXT_GROUP_NAME_MAX_LEN = 120;
export const CONTEXT_GROUPS_MAX_WORKSPACE = 40;
export const CONTEXT_ENTRIES_MAX_PER_GROUP = 50;
export const CONTEXT_TITLE_MAX_LEN = 200;
export const CONTEXT_BODY_MAX_LEN = 8000;

function validateTitleBody(
  titleText: string,
  bodyText: string,
): { ok: true; title: string; body: string } | { ok: false; message: string } {
  const title = titleText.trim();
  const body = bodyText.trim();

  if (title.length === 0 || body.length === 0) {
    return { ok: false, message: "Title and facts text are required." };
  }
  if (title.length > CONTEXT_TITLE_MAX_LEN) {
    return {
      ok: false,
      message: `Title is too long (max ${CONTEXT_TITLE_MAX_LEN} characters).`,
    };
  }
  if (body.length > CONTEXT_BODY_MAX_LEN) {
    return {
      ok: false,
      message: `Facts text is too long (max ${CONTEXT_BODY_MAX_LEN} characters).`,
    };
  }

  return { ok: true, title, body };
}

export async function updateWorkspaceContextGroupName(payload: {
  workspaceId: string;
  groupId: string;
  name: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const nameTrimmed = payload.name.trim();
  if (nameTrimmed.length === 0) {
    return { ok: false, message: "Group name is required." };
  }
  if (nameTrimmed.length > CONTEXT_GROUP_NAME_MAX_LEN) {
    return {
      ok: false,
      message: `Group name is too long (max ${CONTEXT_GROUP_NAME_MAX_LEN} characters).`,
    };
  }

  try {
    await db
      .update(workspaceContextGroups)
      .set({ name: nameTrimmed, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, payload.workspaceId),
          eq(workspaceContextGroups.id, payload.groupId),
        ),
      );

    console.info(`[${scope}/updateWorkspaceContextGroupName] Success: workspaceId=${payload.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceContextGroupName] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function addWorkspaceContextEntry(payload: {
  workspaceId: string;
  groupId: string;
  title: string;
  bodyText: string;
}): Promise<{ ok: true; entry: WorkspaceContextEntryRecord } | { ok: false; message: string }> {
  const v = validateTitleBody(payload.title, payload.bodyText);
  if (!v.ok) return v;

  try {
    const [groupCheck] = await db
      .select({ id: workspaceContextGroups.id })
      .from(workspaceContextGroups)
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, payload.workspaceId),
          eq(workspaceContextGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(`[${scope}/addWorkspaceContextEntry] Failed query: group not found`);
      return { ok: false, message: "Group not found." };
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceContextEntries)
      .where(eq(workspaceContextEntries.groupId, payload.groupId));

    const entryCount = row?.count ?? 0;

    if (entryCount >= CONTEXT_ENTRIES_MAX_PER_GROUP) {
      return {
        ok: false,
        message: `At most ${CONTEXT_ENTRIES_MAX_PER_GROUP} entries per group.`,
      };
    }

    const [maxRow] = await db
      .select({ sortOrder: workspaceContextEntries.sortOrder })
      .from(workspaceContextEntries)
      .where(eq(workspaceContextEntries.groupId, payload.groupId))
      .orderBy(sql`${workspaceContextEntries.sortOrder} desc`)
      .limit(1);

    const nextSort = (maxRow?.sortOrder ?? -1) + 1;

    const [inserted] = await db
      .insert(workspaceContextEntries)
      .values({
        groupId: payload.groupId,
        sortOrder: nextSort,
        title: v.title,
        body: v.body,
      })
      .returning({
        id: workspaceContextEntries.id,
        sortOrder: workspaceContextEntries.sortOrder,
        title: workspaceContextEntries.title,
        body: workspaceContextEntries.body,
      });

    if (!inserted) {
      console.error(`[${scope}/addWorkspaceContextEntry] Failed query: no row`);
      return { ok: false, message: "Insert failed." };
    }

    console.info(`[${scope}/addWorkspaceContextEntry] Success: workspaceId=${payload.workspaceId}`);
    return {
      ok: true,
      entry: {
        id: inserted.id,
        sort_order: inserted.sortOrder,
        title: inserted.title,
        body_text: inserted.body,
      },
    };
  } catch (error) {
    console.error(`[${scope}/addWorkspaceContextEntry] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateWorkspaceContextEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
  title: string;
  bodyText: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = validateTitleBody(payload.title, payload.bodyText);
  if (!v.ok) return v;

  try {
    const [groupCheck] = await db
      .select({ id: workspaceContextGroups.id })
      .from(workspaceContextGroups)
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, payload.workspaceId),
          eq(workspaceContextGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(`[${scope}/updateWorkspaceContextEntry] Failed query: entry not found`);
      return { ok: false, message: "Entry not found." };
    }

    const [entryRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceContextEntries)
      .where(
        and(
          eq(workspaceContextEntries.groupId, payload.groupId),
          eq(workspaceContextEntries.id, payload.entryId),
        ),
      );

    if ((entryRow?.count ?? 0) !== 1) {
      console.error(`[${scope}/updateWorkspaceContextEntry] Failed query: entry not found`);
      return { ok: false, message: "Entry not found." };
    }

    await db
      .update(workspaceContextEntries)
      .set({ title: v.title, body: v.body })
      .where(
        and(
          eq(workspaceContextEntries.groupId, payload.groupId),
          eq(workspaceContextEntries.id, payload.entryId),
        ),
      );

    await db
      .update(workspaceContextGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, payload.workspaceId),
          eq(workspaceContextGroups.id, payload.groupId),
        ),
      );

    console.info(`[${scope}/updateWorkspaceContextEntry] Success: workspaceId=${payload.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceContextEntry] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceContextEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [groupCheck] = await db
      .select({ id: workspaceContextGroups.id })
      .from(workspaceContextGroups)
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, payload.workspaceId),
          eq(workspaceContextGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(`[${scope}/deleteWorkspaceContextEntry] Failed query: group not found`);
      return { ok: false, message: "Group not found." };
    }

    await db
      .delete(workspaceContextEntries)
      .where(
        and(
          eq(workspaceContextEntries.groupId, payload.groupId),
          eq(workspaceContextEntries.id, payload.entryId),
        ),
      );

    await db
      .update(workspaceContextGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, payload.workspaceId),
          eq(workspaceContextGroups.id, payload.groupId),
        ),
      );

    console.info(`[${scope}/deleteWorkspaceContextEntry] Success: workspaceId=${payload.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceContextEntry] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function listWorkspaceContextGroupSummaries(
  workspaceId: string,
): Promise<WorkspaceContextGroupSummary[]> {
  try {
    const groups = await db
      .select({
        id: workspaceContextGroups.id,
        name: workspaceContextGroups.name,
        updatedAt: workspaceContextGroups.updatedAt,
      })
      .from(workspaceContextGroups)
      .where(eq(workspaceContextGroups.workspaceId, workspaceId))
      .orderBy(sql`${workspaceContextGroups.name} asc`);

    if (groups.length === 0) {
      console.info(`[${scope}/listWorkspaceContextGroupSummaries] Success: workspaceId=${workspaceId}`);
      return [];
    }

    const groupIds = groups.map((g) => g.id);

    const counts = await db
      .select({ groupId: workspaceContextEntries.groupId })
      .from(workspaceContextEntries)
      .where(inArray(workspaceContextEntries.groupId, groupIds));

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.groupId, (countMap.get(row.groupId) ?? 0) + 1);
    }

    console.info(`[${scope}/listWorkspaceContextGroupSummaries] Success: workspaceId=${workspaceId}`);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      updated_at: g.updatedAt.toISOString(),
      entry_count: countMap.get(g.id) ?? 0,
    }));
  } catch (error) {
    console.error(`[${scope}/listWorkspaceContextGroupSummaries] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getWorkspaceContextGroupDetail(
  workspaceId: string,
  groupId: string,
): Promise<WorkspaceContextGroupWithEntries | null> {
  try {
    const [group] = await db
      .select({
        id: workspaceContextGroups.id,
        name: workspaceContextGroups.name,
        updatedAt: workspaceContextGroups.updatedAt,
      })
      .from(workspaceContextGroups)
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, workspaceId),
          eq(workspaceContextGroups.id, groupId),
        ),
      )
      .limit(1);

    if (!group) {
      console.error(`[${scope}/getWorkspaceContextGroupDetail] Failed query: group not found`);
      return null;
    }

    const entries = await db
      .select({
        id: workspaceContextEntries.id,
        sortOrder: workspaceContextEntries.sortOrder,
        title: workspaceContextEntries.title,
        body: workspaceContextEntries.body,
      })
      .from(workspaceContextEntries)
      .where(eq(workspaceContextEntries.groupId, groupId))
      .orderBy(sql`${workspaceContextEntries.sortOrder} asc`);

    console.info(`[${scope}/getWorkspaceContextGroupDetail] Success: workspaceId=${workspaceId}`);
    return {
      id: group.id,
      name: group.name,
      updated_at: group.updatedAt.toISOString(),
      entries: entries.map((e) => ({
        id: e.id,
        sort_order: e.sortOrder,
        title: e.title,
        body_text: e.body,
      })),
    };
  } catch (error) {
    console.error(`[${scope}/getWorkspaceContextGroupDetail] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createWorkspaceContextGroup(
  workspaceId: string,
  nameTrimmed: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceContextGroups)
      .where(eq(workspaceContextGroups.workspaceId, workspaceId));

    const count = row?.count ?? 0;

    if (count >= CONTEXT_GROUPS_MAX_WORKSPACE) {
      return { ok: false, message: `At most ${CONTEXT_GROUPS_MAX_WORKSPACE} groups per workspace.` };
    }

    const [inserted] = await db
      .insert(workspaceContextGroups)
      .values({ workspaceId, name: nameTrimmed })
      .returning({ id: workspaceContextGroups.id });

    if (!inserted) {
      console.error(`[${scope}/createWorkspaceContextGroup] Failed query: insert returned no row`);
      return { ok: false, message: "Insert failed." };
    }

    console.info(`[${scope}/createWorkspaceContextGroup] Success: workspaceId=${workspaceId}`);
    return { ok: true, id: inserted.id };
  } catch (error) {
    console.error(`[${scope}/createWorkspaceContextGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceContextGroup(
  workspaceId: string,
  groupId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await stripContextGroupIdFromAgents(workspaceId, groupId);

    await db
      .delete(workspaceContextGroups)
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, workspaceId),
          eq(workspaceContextGroups.id, groupId),
        ),
      );

    console.info(`[${scope}/deleteWorkspaceContextGroup] Success: workspaceId=${workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceContextGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

async function stripContextGroupIdFromAgents(workspaceId: string, groupId: string): Promise<void> {
  const { listAgentConfigs } = await import("./agent.js");
  const agents = await listAgentConfigs(workspaceId);

  for (const agent of agents) {
    const current = normalizeContextGroupIds(agent.context_groups);
    if (!current.includes(groupId)) continue;

    const next = current.filter((id) => id !== groupId);

    try {
      await db
        .update(agentConfigs)
        .set({ contextGroups: next })
        .where(
          and(
            eq(agentConfigs.id, agent.id),
            eq(agentConfigs.workspaceId, workspaceId),
            isNull(agentConfigs.archivedAt),
          ),
        );
    } catch (error) {
      console.error(`[${scope}/stripContextGroupIdFromAgents] Failed query: ${String(error)}`);
    }
  }

  console.info(`[${scope}/stripContextGroupIdFromAgents] Success: workspaceId=${workspaceId}`);
}

export async function validateContextGroupIdsForWorkspace(
  workspaceId: string,
  ids: string[],
): Promise<{ ok: true; normalized: string[] } | { ok: false; message: string }> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) {
    return { ok: true, normalized: [] };
  }

  try {
    const data = await db
      .select({ id: workspaceContextGroups.id })
      .from(workspaceContextGroups)
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, workspaceId),
          inArray(workspaceContextGroups.id, unique),
        ),
      );

    const found = new Set(data.map((r) => r.id));
    for (const id of unique) {
      if (!found.has(id)) {
        return { ok: false, message: "Unknown workspace context group." };
      }
    }

    console.info(`[${scope}/validateContextGroupIdsForWorkspace] Success: workspaceId=${workspaceId}`);
    return { ok: true, normalized: unique };
  } catch (error) {
    console.error(`[${scope}/validateContextGroupIdsForWorkspace] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export type ContextGroupForInstructions = {
  name: string;
  entries: { title: string; body_text: string }[];
};

export async function listWorkspaceContextForInstructions(
  workspaceId: string,
  groupIds: string[],
): Promise<ContextGroupForInstructions[]> {
  if (groupIds.length === 0) return [];

  try {
    const groups = await db
      .select({
        id: workspaceContextGroups.id,
        name: workspaceContextGroups.name,
      })
      .from(workspaceContextGroups)
      .where(
        and(
          eq(workspaceContextGroups.workspaceId, workspaceId),
          inArray(workspaceContextGroups.id, groupIds),
        ),
      );

    if (groups.length === 0) {
      return [];
    }

    const entries = await db
      .select({
        groupId: workspaceContextEntries.groupId,
        title: workspaceContextEntries.title,
        body: workspaceContextEntries.body,
        sortOrder: workspaceContextEntries.sortOrder,
      })
      .from(workspaceContextEntries)
      .where(inArray(workspaceContextEntries.groupId, groupIds));

    const byGroup = new Map<string, typeof entries>();
    for (const row of entries) {
      const bucket = byGroup.get(row.groupId) ?? [];
      bucket.push(row);
      byGroup.set(row.groupId, bucket);
    }

    const result: ContextGroupForInstructions[] = [];
    const idToName = new Map(groups.map((x) => [x.id, x.name]));

    for (const gid of groupIds) {
      const name = idToName.get(gid);
      if (!name) continue;

      const rowsByGroup = (byGroup.get(gid) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

      result.push({
        name,
        entries: rowsByGroup.map((x) => ({
          title: x.title,
          body_text: x.body,
        })),
      });
    }

    console.info(`[${scope}/listWorkspaceContextForInstructions] Success: workspaceId=${workspaceId}`);
    return result;
  } catch (error) {
    console.error(`[${scope}/listWorkspaceContextForInstructions] Unexpected error: ${String(error)}`);
    return [];
  }
}

export function normalizeContextGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}
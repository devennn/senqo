import { eq, and, inArray, asc, desc, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaceHandoffTopicGroups,
  workspaceHandoffTopicEntries,
  agentConfigs,
} from "../db/schema/index.js";
import type {
  WorkspaceHandoffTopicEntryRecord,
  WorkspaceHandoffTopicGroupSummary,
  WorkspaceHandoffTopicGroupWithEntries,
} from "../types/repositories.js";

const scope = "HandoffTopicGroupsRepository";

export const HANDOFF_TOPIC_GROUP_NAME_MAX_LEN = 120;
export const HANDOFF_TOPIC_GROUPS_MAX_WORKSPACE = 40;
export const HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP = 25;
export const HANDOFF_TOPIC_TITLE_MAX_LEN = 200;
export const HANDOFF_TOPIC_DESCRIPTION_MAX_LEN = 2000;

function validateTopicRow(
  topic: string,
  description: string,
): { ok: true; t: string; d: string } | { ok: false; message: string } {
  const t = topic.trim();
  const d = description.trim();
  if (t.length === 0) {
    return { ok: false, message: "Topic is required." };
  }
  if (t.length > HANDOFF_TOPIC_TITLE_MAX_LEN) {
    return {
      ok: false,
      message: `Topic is too long (max ${HANDOFF_TOPIC_TITLE_MAX_LEN} characters).`,
    };
  }
  if (d.length > HANDOFF_TOPIC_DESCRIPTION_MAX_LEN) {
    return {
      ok: false,
      message: `Description is too long (max ${HANDOFF_TOPIC_DESCRIPTION_MAX_LEN} characters).`,
    };
  }
  return { ok: true, t, d };
}

async function verifyGroupOwnership(
  workspaceId: string,
  groupId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: workspaceHandoffTopicGroups.id })
    .from(workspaceHandoffTopicGroups)
    .where(
      and(
        eq(workspaceHandoffTopicGroups.workspaceId, workspaceId),
        eq(workspaceHandoffTopicGroups.id, groupId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function updateWorkspaceHandoffTopicGroupName(payload: {
  workspaceId: string;
  groupId: string;
  name: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const nameTrimmed = payload.name.trim();
  if (nameTrimmed.length === 0) {
    return { ok: false, message: "Group name is required." };
  }
  if (nameTrimmed.length > HANDOFF_TOPIC_GROUP_NAME_MAX_LEN) {
    return {
      ok: false,
      message: `Group name is too long (max ${HANDOFF_TOPIC_GROUP_NAME_MAX_LEN} characters).`,
    };
  }

  try {
    await db
      .update(workspaceHandoffTopicGroups)
      .set({ name: nameTrimmed, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, payload.workspaceId),
          eq(workspaceHandoffTopicGroups.id, payload.groupId),
        ),
      );

    console.info(
      `[${scope}/updateWorkspaceHandoffTopicGroupName] Success: workspaceId=${payload.workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/updateWorkspaceHandoffTopicGroupName] Failed query: ${message}`);
    return { ok: false, message };
  }
}

export async function addWorkspaceHandoffTopicEntry(payload: {
  workspaceId: string;
  groupId: string;
  topic: string;
  description: string;
}): Promise<
  { ok: true; entry: WorkspaceHandoffTopicEntryRecord } | { ok: false; message: string }
> {
  const v = validateTopicRow(payload.topic, payload.description);
  if (!v.ok) return v;

  try {
    const owns = await verifyGroupOwnership(payload.workspaceId, payload.groupId);
    if (!owns) {
      return { ok: false, message: "Group not found." };
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceHandoffTopicEntries)
      .where(eq(workspaceHandoffTopicEntries.groupId, payload.groupId));

    const entryCount = countResult[0]?.count ?? 0;

    if (entryCount >= HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP) {
      return {
        ok: false,
        message: `At most ${HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP} topics per group.`,
      };
    }

    const maxRows = await db
      .select({ sortOrder: workspaceHandoffTopicEntries.sortOrder })
      .from(workspaceHandoffTopicEntries)
      .where(eq(workspaceHandoffTopicEntries.groupId, payload.groupId))
      .orderBy(desc(workspaceHandoffTopicEntries.sortOrder))
      .limit(1);

    const nextSort = (maxRows[0]?.sortOrder ?? -1) + 1;

    const inserted = await db
      .insert(workspaceHandoffTopicEntries)
      .values({
        groupId: payload.groupId,
        sortOrder: nextSort,
        title: v.t,
        description: v.d,
      })
      .returning({
        id: workspaceHandoffTopicEntries.id,
        sortOrder: workspaceHandoffTopicEntries.sortOrder,
        title: workspaceHandoffTopicEntries.title,
        description: workspaceHandoffTopicEntries.description,
      });

    const row = inserted[0];
    if (!row) {
      console.error(`[${scope}/addWorkspaceHandoffTopicEntry] Failed query: insert returned no row`);
      return { ok: false, message: "Insert failed." };
    }

    await db
      .update(workspaceHandoffTopicGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, payload.workspaceId),
          eq(workspaceHandoffTopicGroups.id, payload.groupId),
        ),
      );

    console.info(
      `[${scope}/addWorkspaceHandoffTopicEntry] Success: workspaceId=${payload.workspaceId}`,
    );
    return {
      ok: true,
      entry: {
        id: row.id,
        sort_order: row.sortOrder,
        topic: row.title,
        description: row.description,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/addWorkspaceHandoffTopicEntry] Failed query: ${message}`);
    return { ok: false, message };
  }
}

export async function updateWorkspaceHandoffTopicEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
  topic: string;
  description: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = validateTopicRow(payload.topic, payload.description);
  if (!v.ok) return v;

  try {
    const owns = await verifyGroupOwnership(payload.workspaceId, payload.groupId);
    if (!owns) {
      return { ok: false, message: "Group not found." };
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceHandoffTopicEntries)
      .where(
        and(
          eq(workspaceHandoffTopicEntries.groupId, payload.groupId),
          eq(workspaceHandoffTopicEntries.id, payload.entryId),
        ),
      );

    const ownsEntry = countResult[0]?.count ?? 0;

    if (ownsEntry !== 1) {
      console.error(`[${scope}/updateWorkspaceHandoffTopicEntry] Failed query: entry not found`);
      return { ok: false, message: "Topic not found." };
    }

    await db
      .update(workspaceHandoffTopicEntries)
      .set({ title: v.t, description: v.d })
      .where(
        and(
          eq(workspaceHandoffTopicEntries.groupId, payload.groupId),
          eq(workspaceHandoffTopicEntries.id, payload.entryId),
        ),
      );

    await db
      .update(workspaceHandoffTopicGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, payload.workspaceId),
          eq(workspaceHandoffTopicGroups.id, payload.groupId),
        ),
      );

    console.info(
      `[${scope}/updateWorkspaceHandoffTopicEntry] Success: workspaceId=${payload.workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/updateWorkspaceHandoffTopicEntry] Failed query: ${message}`);
    return { ok: false, message };
  }
}

export async function deleteWorkspaceHandoffTopicEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const owns = await verifyGroupOwnership(payload.workspaceId, payload.groupId);
    if (!owns) {
      return { ok: false, message: "Group not found." };
    }

    await db
      .delete(workspaceHandoffTopicEntries)
      .where(
        and(
          eq(workspaceHandoffTopicEntries.groupId, payload.groupId),
          eq(workspaceHandoffTopicEntries.id, payload.entryId),
        ),
      );

    await db
      .update(workspaceHandoffTopicGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, payload.workspaceId),
          eq(workspaceHandoffTopicGroups.id, payload.groupId),
        ),
      );

    console.info(
      `[${scope}/deleteWorkspaceHandoffTopicEntry] Success: workspaceId=${payload.workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/deleteWorkspaceHandoffTopicEntry] Failed query: ${message}`);
    return { ok: false, message };
  }
}

export async function listWorkspaceHandoffTopicGroupSummaries(
  workspaceId: string,
): Promise<WorkspaceHandoffTopicGroupSummary[]> {
  try {
    const groupRows = await db
      .select({
        id: workspaceHandoffTopicGroups.id,
        name: workspaceHandoffTopicGroups.name,
        updatedAt: workspaceHandoffTopicGroups.updatedAt,
      })
      .from(workspaceHandoffTopicGroups)
      .where(eq(workspaceHandoffTopicGroups.workspaceId, workspaceId))
      .orderBy(asc(workspaceHandoffTopicGroups.name));

    if (groupRows.length === 0) {
      console.info(
        `[${scope}/listWorkspaceHandoffTopicGroupSummaries] Success: workspaceId=${workspaceId}`,
      );
      return [];
    }

    const groupIds = groupRows.map((g) => g.id);

    const countRows = await db
      .select({
        groupId: workspaceHandoffTopicEntries.groupId,
        count: sql<number>`count(*)`,
      })
      .from(workspaceHandoffTopicEntries)
      .where(inArray(workspaceHandoffTopicEntries.groupId, groupIds))
      .groupBy(workspaceHandoffTopicEntries.groupId);

    const countMap = new Map<string, number>();
    for (const row of countRows) {
      countMap.set(row.groupId, row.count);
    }

    console.info(
      `[${scope}/listWorkspaceHandoffTopicGroupSummaries] Success: workspaceId=${workspaceId}`,
    );
    return groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      updated_at: g.updatedAt as unknown as string,
      entry_count: countMap.get(g.id) ?? 0,
    }));
  } catch (error) {
    console.error(
      `[${scope}/listWorkspaceHandoffTopicGroupSummaries] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function getWorkspaceHandoffTopicGroupDetail(
  workspaceId: string,
  groupId: string,
): Promise<WorkspaceHandoffTopicGroupWithEntries | null> {
  try {
    const groupRows = await db
      .select({
        id: workspaceHandoffTopicGroups.id,
        name: workspaceHandoffTopicGroups.name,
        updatedAt: workspaceHandoffTopicGroups.updatedAt,
      })
      .from(workspaceHandoffTopicGroups)
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, workspaceId),
          eq(workspaceHandoffTopicGroups.id, groupId),
        ),
      )
      .limit(1);

    const group = groupRows[0] ?? null;

    if (!group) {
      console.error(
        `[${scope}/getWorkspaceHandoffTopicGroupDetail] Failed query: group not found`,
      );
      return null;
    }

    const entryRows = await db
      .select({
        id: workspaceHandoffTopicEntries.id,
        sortOrder: workspaceHandoffTopicEntries.sortOrder,
        title: workspaceHandoffTopicEntries.title,
        description: workspaceHandoffTopicEntries.description,
      })
      .from(workspaceHandoffTopicEntries)
      .where(eq(workspaceHandoffTopicEntries.groupId, groupId))
      .orderBy(asc(workspaceHandoffTopicEntries.sortOrder));

    console.info(
      `[${scope}/getWorkspaceHandoffTopicGroupDetail] Success: workspaceId=${workspaceId}`,
    );
    return {
      id: group.id,
      name: group.name,
      updated_at: group.updatedAt as unknown as string,
      entries: entryRows.map((e) => ({
        id: e.id,
        sort_order: e.sortOrder,
        topic: e.title,
        description: e.description,
      })),
    };
  } catch (error) {
    console.error(
      `[${scope}/getWorkspaceHandoffTopicGroupDetail] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export async function createWorkspaceHandoffTopicGroup(
  workspaceId: string,
  nameTrimmed: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceHandoffTopicGroups)
      .where(eq(workspaceHandoffTopicGroups.workspaceId, workspaceId));

    const count = countResult[0]?.count ?? 0;

    if (count >= HANDOFF_TOPIC_GROUPS_MAX_WORKSPACE) {
      return {
        ok: false,
        message: `At most ${HANDOFF_TOPIC_GROUPS_MAX_WORKSPACE} handoff groups per workspace.`,
      };
    }

    const inserted = await db
      .insert(workspaceHandoffTopicGroups)
      .values({ workspaceId, name: nameTrimmed })
      .returning({ id: workspaceHandoffTopicGroups.id });

    const row = inserted[0];
    console.info(
      `[${scope}/createWorkspaceHandoffTopicGroup] Success: workspaceId=${workspaceId}`,
    );
    return { ok: true, id: row?.id ?? "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createWorkspaceHandoffTopicGroup] Failed query: ${message}`);
    return { ok: false, message };
  }
}

async function stripHandoffTopicGroupIdFromAgents(
  workspaceId: string,
  groupId: string,
): Promise<void> {
  const { listAgentConfigs } = await import("./agent.js");

  try {
    const agents = await listAgentConfigs(workspaceId);

    for (const agent of agents) {
      const current = normalizeHandoffTopicGroupIds(agent.handoff_topic_groups);
      if (!current.includes(groupId)) continue;

      const next = current.filter((id) => id !== groupId);
      await db
        .update(agentConfigs)
        .set({ handoffTopicGroups: next })
        .where(
          and(
            eq(agentConfigs.id, agent.id),
            eq(agentConfigs.workspaceId, workspaceId),
            isNull(agentConfigs.archivedAt),
          ),
        );
    }

    console.info(
      `[${scope}/stripHandoffTopicGroupIdFromAgents] Success: workspaceId=${workspaceId}`,
    );
  } catch (error) {
    console.error(
      `[${scope}/stripHandoffTopicGroupIdFromAgents] Failed query: ${String(error)}`,
    );
  }
}

export async function deleteWorkspaceHandoffTopicGroup(
  workspaceId: string,
  groupId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await stripHandoffTopicGroupIdFromAgents(workspaceId, groupId);

    await db
      .delete(workspaceHandoffTopicGroups)
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, workspaceId),
          eq(workspaceHandoffTopicGroups.id, groupId),
        ),
      );

    console.info(
      `[${scope}/deleteWorkspaceHandoffTopicGroup] Success: workspaceId=${workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/deleteWorkspaceHandoffTopicGroup] Failed query: ${message}`);
    return { ok: false, message };
  }
}

export async function validateHandoffTopicGroupIdsForWorkspace(
  workspaceId: string,
  ids: string[],
): Promise<{ ok: true; normalized: string[] } | { ok: false; message: string }> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) {
    return { ok: true, normalized: [] };
  }

  try {
    const rows = await db
      .select({ id: workspaceHandoffTopicGroups.id })
      .from(workspaceHandoffTopicGroups)
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, workspaceId),
          inArray(workspaceHandoffTopicGroups.id, unique),
        ),
      );

    const found = new Set(rows.map((r) => r.id));
    for (const id of unique) {
      if (!found.has(id)) {
        return { ok: false, message: "Unknown handoff topic group." };
      }
    }

    console.info(
      `[${scope}/validateHandoffTopicGroupIdsForWorkspace] Success: workspaceId=${workspaceId}`,
    );
    return { ok: true, normalized: unique };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[${scope}/validateHandoffTopicGroupIdsForWorkspace] Failed query: ${message}`,
    );
    return { ok: false, message };
  }
}

export type HandoffTopicGroupForInstructions = {
  name: string;
  entries: { topic: string; description: string }[];
};

export async function listHandoffTopicsForInstructions(
  workspaceId: string,
  groupIds: string[],
): Promise<HandoffTopicGroupForInstructions[]> {
  if (groupIds.length === 0) return [];

  try {
    const groupRows = await db
      .select({
        id: workspaceHandoffTopicGroups.id,
        name: workspaceHandoffTopicGroups.name,
      })
      .from(workspaceHandoffTopicGroups)
      .where(
        and(
          eq(workspaceHandoffTopicGroups.workspaceId, workspaceId),
          inArray(workspaceHandoffTopicGroups.id, groupIds),
        ),
      );

    if (groupRows.length === 0) {
      console.info(
        `[${scope}/listHandoffTopicsForInstructions] Success: workspaceId=${workspaceId}`,
      );
      return [];
    }

    const entryRows = await db
      .select({
        groupId: workspaceHandoffTopicEntries.groupId,
        title: workspaceHandoffTopicEntries.title,
        description: workspaceHandoffTopicEntries.description,
        sortOrder: workspaceHandoffTopicEntries.sortOrder,
      })
      .from(workspaceHandoffTopicEntries)
      .where(inArray(workspaceHandoffTopicEntries.groupId, groupIds));

    const byGroup = new Map<string, typeof entryRows>();
    for (const row of entryRows) {
      const bucket = byGroup.get(row.groupId) ?? [];
      bucket.push(row);
      byGroup.set(row.groupId, bucket);
    }

    const result: HandoffTopicGroupForInstructions[] = [];
    const idToName = new Map(groupRows.map((x) => [x.id, x.name]));

    for (const gid of groupIds) {
      const name = idToName.get(gid);
      if (!name) continue;

      const rowsByGroup = (byGroup.get(gid) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

      result.push({
        name,
        entries: rowsByGroup.map((x) => ({
          topic: x.title,
          description: x.description,
        })),
      });
    }

    console.info(
      `[${scope}/listHandoffTopicsForInstructions] Success: workspaceId=${workspaceId}`,
    );
    return result;
  } catch (error) {
    console.error(
      `[${scope}/listHandoffTopicsForInstructions] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export function normalizeHandoffTopicGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}
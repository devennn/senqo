import { eq, and, inArray, sql, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaceButtonTemplateGroups,
  workspaceButtonTemplateEntries,
  agentConfigs,
} from "../db/schema/index.js";
import type {
  ButtonTemplateButton,
  ButtonTemplateButtonType,
  WorkspaceButtonTemplateEntryRecord,
  WorkspaceButtonTemplateGroupSummary,
  WorkspaceButtonTemplateGroupWithEntries,
} from "../types/repositories.js";
import { BUTTON_TEMPLATE_BUTTON_TYPES } from "../types/repositories.js";

const scope = "ButtonTemplatesRepository";

export const BUTTON_TEMPLATE_GROUP_NAME_MAX_LEN = 120;
export const BUTTON_TEMPLATE_GROUPS_MAX_WORKSPACE = 40;
export const BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP = 50;
export const BUTTON_TEMPLATE_TITLE_MAX_LEN = 200;
export const BUTTON_TEMPLATE_BODY_MAX_LEN = 4000;
export const BUTTON_TEMPLATE_BUTTONS_MAX = 3;
export const BUTTON_TEMPLATE_BUTTON_LABEL_MAX_LEN = 40;
export const BUTTON_TEMPLATE_BUTTON_VALUE_MAX_LEN = 1024;

function isButtonType(value: unknown): value is ButtonTemplateButtonType {
  return (
    typeof value === "string" &&
    (BUTTON_TEMPLATE_BUTTON_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Parse + validate the button list stored on an entry. Returns null when the
 * shape is unusable so callers can fail loudly instead of sending garbage.
 */
export function parseButtonTemplateButtons(
  value: unknown,
): ButtonTemplateButton[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length < 1 || value.length > BUTTON_TEMPLATE_BUTTONS_MAX) return null;

  const buttons: ButtonTemplateButton[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as { type?: unknown; label?: unknown; value?: unknown };
    if (!isButtonType(item.type)) return null;
    if (typeof item.label !== "string" || typeof item.value !== "string") {
      return null;
    }
    const label = item.label.trim();
    const buttonValue = item.value.trim();
    if (label.length === 0 || buttonValue.length === 0) return null;
    buttons.push({ type: item.type, label, value: buttonValue });
  }
  return buttons;
}

function validateEntryInput(input: {
  title: string;
  body: string;
  buttons: unknown;
}):
  | { ok: true; title: string; body: string; buttons: ButtonTemplateButton[] }
  | { ok: false; message: string } {
  const title = input.title.trim();
  const body = input.body.trim();

  if (title.length === 0 || body.length === 0) {
    return { ok: false, message: "Name and message text are required." };
  }
  if (title.length > BUTTON_TEMPLATE_TITLE_MAX_LEN) {
    return {
      ok: false,
      message: `Name is too long (max ${BUTTON_TEMPLATE_TITLE_MAX_LEN} characters).`,
    };
  }
  if (body.length > BUTTON_TEMPLATE_BODY_MAX_LEN) {
    return {
      ok: false,
      message: `Message text is too long (max ${BUTTON_TEMPLATE_BODY_MAX_LEN} characters).`,
    };
  }

  const buttons = parseButtonTemplateButtons(input.buttons);
  if (!buttons) {
    return {
      ok: false,
      message: `Add 1 to ${BUTTON_TEMPLATE_BUTTONS_MAX} buttons with a label and a value.`,
    };
  }

  for (const button of buttons) {
    if (button.label.length > BUTTON_TEMPLATE_BUTTON_LABEL_MAX_LEN) {
      return {
        ok: false,
        message: `Button label is too long (max ${BUTTON_TEMPLATE_BUTTON_LABEL_MAX_LEN} characters).`,
      };
    }
    if (button.value.length > BUTTON_TEMPLATE_BUTTON_VALUE_MAX_LEN) {
      return {
        ok: false,
        message: `Button value is too long (max ${BUTTON_TEMPLATE_BUTTON_VALUE_MAX_LEN} characters).`,
      };
    }
    if (button.type === "cta_url") {
      let parsed: URL;
      try {
        parsed = new URL(button.value);
      } catch {
        return { ok: false, message: "URL buttons need a valid https:// link." };
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, message: "URL buttons need a valid https:// link." };
      }
    }
    if (button.type === "cta_call" && !/^\+?[0-9 ()-]{5,20}$/.test(button.value)) {
      return { ok: false, message: "Call buttons need a phone number." };
    }
  }

  return { ok: true, title, body, buttons };
}

function toEntryRecord(row: {
  id: string;
  sortOrder: number;
  title: string;
  body: string;
  buttons: unknown;
}): WorkspaceButtonTemplateEntryRecord {
  return {
    id: row.id,
    sort_order: row.sortOrder,
    title: row.title,
    body: row.body,
    buttons: parseButtonTemplateButtons(row.buttons) ?? [],
  };
}

export async function updateWorkspaceButtonTemplateGroupName(payload: {
  workspaceId: string;
  groupId: string;
  name: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const nameTrimmed = payload.name.trim();
  if (nameTrimmed.length === 0) {
    return { ok: false, message: "Group name is required." };
  }
  if (nameTrimmed.length > BUTTON_TEMPLATE_GROUP_NAME_MAX_LEN) {
    return {
      ok: false,
      message: `Group name is too long (max ${BUTTON_TEMPLATE_GROUP_NAME_MAX_LEN} characters).`,
    };
  }

  try {
    await db
      .update(workspaceButtonTemplateGroups)
      .set({ name: nameTrimmed, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceButtonTemplateGroups.id, payload.groupId),
        ),
      );

    console.info(
      `[${scope}/updateWorkspaceButtonTemplateGroupName] Success: workspaceId=${payload.workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/updateWorkspaceButtonTemplateGroupName] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

async function touchGroup(workspaceId: string, groupId: string): Promise<void> {
  await db
    .update(workspaceButtonTemplateGroups)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(workspaceButtonTemplateGroups.workspaceId, workspaceId),
        eq(workspaceButtonTemplateGroups.id, groupId),
      ),
    );
}

export async function addWorkspaceButtonTemplateEntry(payload: {
  workspaceId: string;
  groupId: string;
  title: string;
  body: string;
  buttons: unknown;
}): Promise<
  | { ok: true; entry: WorkspaceButtonTemplateEntryRecord }
  | { ok: false; message: string }
> {
  const v = validateEntryInput(payload);
  if (!v.ok) return v;

  try {
    const [groupCheck] = await db
      .select({ id: workspaceButtonTemplateGroups.id })
      .from(workspaceButtonTemplateGroups)
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceButtonTemplateGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(
        `[${scope}/addWorkspaceButtonTemplateEntry] Failed query: group not found`,
      );
      return { ok: false, message: "Group not found." };
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceButtonTemplateEntries)
      .where(eq(workspaceButtonTemplateEntries.groupId, payload.groupId));

    const entryCount = row?.count ?? 0;

    if (entryCount >= BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP) {
      return {
        ok: false,
        message: `At most ${BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP} templates per group.`,
      };
    }

    const [maxRow] = await db
      .select({ sortOrder: workspaceButtonTemplateEntries.sortOrder })
      .from(workspaceButtonTemplateEntries)
      .where(eq(workspaceButtonTemplateEntries.groupId, payload.groupId))
      .orderBy(sql`${workspaceButtonTemplateEntries.sortOrder} desc`)
      .limit(1);

    const nextSort = (maxRow?.sortOrder ?? -1) + 1;

    const [inserted] = await db
      .insert(workspaceButtonTemplateEntries)
      .values({
        groupId: payload.groupId,
        sortOrder: nextSort,
        title: v.title,
        body: v.body,
        buttons: v.buttons,
      })
      .returning({
        id: workspaceButtonTemplateEntries.id,
        sortOrder: workspaceButtonTemplateEntries.sortOrder,
        title: workspaceButtonTemplateEntries.title,
        body: workspaceButtonTemplateEntries.body,
        buttons: workspaceButtonTemplateEntries.buttons,
      });

    if (!inserted) {
      console.error(
        `[${scope}/addWorkspaceButtonTemplateEntry] Failed query: no row`,
      );
      return { ok: false, message: "Insert failed." };
    }

    await touchGroup(payload.workspaceId, payload.groupId);

    console.info(
      `[${scope}/addWorkspaceButtonTemplateEntry] Success: workspaceId=${payload.workspaceId}`,
    );
    return { ok: true, entry: toEntryRecord(inserted) };
  } catch (error) {
    console.error(
      `[${scope}/addWorkspaceButtonTemplateEntry] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateWorkspaceButtonTemplateEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
  title: string;
  body: string;
  buttons: unknown;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = validateEntryInput(payload);
  if (!v.ok) return v;

  try {
    const [entryRow] = await db
      .select({ id: workspaceButtonTemplateEntries.id })
      .from(workspaceButtonTemplateEntries)
      .innerJoin(
        workspaceButtonTemplateGroups,
        eq(workspaceButtonTemplateEntries.groupId, workspaceButtonTemplateGroups.id),
      )
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceButtonTemplateEntries.groupId, payload.groupId),
          eq(workspaceButtonTemplateEntries.id, payload.entryId),
        ),
      )
      .limit(1);

    if (!entryRow) {
      console.error(
        `[${scope}/updateWorkspaceButtonTemplateEntry] Failed query: entry not found`,
      );
      return { ok: false, message: "Template not found." };
    }

    await db
      .update(workspaceButtonTemplateEntries)
      .set({
        title: v.title,
        body: v.body,
        buttons: v.buttons,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceButtonTemplateEntries.groupId, payload.groupId),
          eq(workspaceButtonTemplateEntries.id, payload.entryId),
        ),
      );

    await touchGroup(payload.workspaceId, payload.groupId);

    console.info(
      `[${scope}/updateWorkspaceButtonTemplateEntry] Success: workspaceId=${payload.workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/updateWorkspaceButtonTemplateEntry] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceButtonTemplateEntry(payload: {
  workspaceId: string;
  groupId: string;
  entryId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [groupCheck] = await db
      .select({ id: workspaceButtonTemplateGroups.id })
      .from(workspaceButtonTemplateGroups)
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, payload.workspaceId),
          eq(workspaceButtonTemplateGroups.id, payload.groupId),
        ),
      )
      .limit(1);

    if (!groupCheck) {
      console.error(
        `[${scope}/deleteWorkspaceButtonTemplateEntry] Failed query: group not found`,
      );
      return { ok: false, message: "Group not found." };
    }

    await db
      .delete(workspaceButtonTemplateEntries)
      .where(
        and(
          eq(workspaceButtonTemplateEntries.groupId, payload.groupId),
          eq(workspaceButtonTemplateEntries.id, payload.entryId),
        ),
      );

    await touchGroup(payload.workspaceId, payload.groupId);

    console.info(
      `[${scope}/deleteWorkspaceButtonTemplateEntry] Success: workspaceId=${payload.workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/deleteWorkspaceButtonTemplateEntry] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

export async function listWorkspaceButtonTemplateGroupSummaries(
  workspaceId: string,
): Promise<WorkspaceButtonTemplateGroupSummary[]> {
  try {
    const groups = await db
      .select({
        id: workspaceButtonTemplateGroups.id,
        name: workspaceButtonTemplateGroups.name,
        updatedAt: workspaceButtonTemplateGroups.updatedAt,
      })
      .from(workspaceButtonTemplateGroups)
      .where(eq(workspaceButtonTemplateGroups.workspaceId, workspaceId))
      .orderBy(sql`${workspaceButtonTemplateGroups.name} asc`);

    if (groups.length === 0) {
      console.info(
        `[${scope}/listWorkspaceButtonTemplateGroupSummaries] Success: workspaceId=${workspaceId}`,
      );
      return [];
    }

    const groupIds = groups.map((g) => g.id);

    const counts = await db
      .select({ groupId: workspaceButtonTemplateEntries.groupId })
      .from(workspaceButtonTemplateEntries)
      .where(inArray(workspaceButtonTemplateEntries.groupId, groupIds));

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.groupId, (countMap.get(row.groupId) ?? 0) + 1);
    }

    console.info(
      `[${scope}/listWorkspaceButtonTemplateGroupSummaries] Success: workspaceId=${workspaceId}`,
    );
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      updated_at: g.updatedAt.toISOString(),
      entry_count: countMap.get(g.id) ?? 0,
    }));
  } catch (error) {
    console.error(
      `[${scope}/listWorkspaceButtonTemplateGroupSummaries] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function getWorkspaceButtonTemplateGroupDetail(
  workspaceId: string,
  groupId: string,
): Promise<WorkspaceButtonTemplateGroupWithEntries | null> {
  try {
    const [group] = await db
      .select({
        id: workspaceButtonTemplateGroups.id,
        name: workspaceButtonTemplateGroups.name,
        updatedAt: workspaceButtonTemplateGroups.updatedAt,
      })
      .from(workspaceButtonTemplateGroups)
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, workspaceId),
          eq(workspaceButtonTemplateGroups.id, groupId),
        ),
      )
      .limit(1);

    if (!group) {
      console.error(
        `[${scope}/getWorkspaceButtonTemplateGroupDetail] Failed query: group not found`,
      );
      return null;
    }

    const entries = await db
      .select({
        id: workspaceButtonTemplateEntries.id,
        sortOrder: workspaceButtonTemplateEntries.sortOrder,
        title: workspaceButtonTemplateEntries.title,
        body: workspaceButtonTemplateEntries.body,
        buttons: workspaceButtonTemplateEntries.buttons,
      })
      .from(workspaceButtonTemplateEntries)
      .where(eq(workspaceButtonTemplateEntries.groupId, groupId))
      .orderBy(sql`${workspaceButtonTemplateEntries.sortOrder} asc`);

    console.info(
      `[${scope}/getWorkspaceButtonTemplateGroupDetail] Success: workspaceId=${workspaceId}`,
    );
    return {
      id: group.id,
      name: group.name,
      updated_at: group.updatedAt.toISOString(),
      entries: entries.map(toEntryRecord),
    };
  } catch (error) {
    console.error(
      `[${scope}/getWorkspaceButtonTemplateGroupDetail] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export async function createWorkspaceButtonTemplateGroup(
  workspaceId: string,
  nameTrimmed: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceButtonTemplateGroups)
      .where(eq(workspaceButtonTemplateGroups.workspaceId, workspaceId));

    const count = row?.count ?? 0;

    if (count >= BUTTON_TEMPLATE_GROUPS_MAX_WORKSPACE) {
      return {
        ok: false,
        message: `At most ${BUTTON_TEMPLATE_GROUPS_MAX_WORKSPACE} groups per workspace.`,
      };
    }

    const [inserted] = await db
      .insert(workspaceButtonTemplateGroups)
      .values({ workspaceId, name: nameTrimmed })
      .returning({ id: workspaceButtonTemplateGroups.id });

    if (!inserted) {
      console.error(
        `[${scope}/createWorkspaceButtonTemplateGroup] Failed query: insert returned no row`,
      );
      return { ok: false, message: "Insert failed." };
    }

    console.info(
      `[${scope}/createWorkspaceButtonTemplateGroup] Success: workspaceId=${workspaceId}`,
    );
    return { ok: true, id: inserted.id };
  } catch (error) {
    console.error(
      `[${scope}/createWorkspaceButtonTemplateGroup] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteWorkspaceButtonTemplateGroup(
  workspaceId: string,
  groupId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await stripButtonTemplateGroupIdFromAgents(workspaceId, groupId);

    await db
      .delete(workspaceButtonTemplateGroups)
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, workspaceId),
          eq(workspaceButtonTemplateGroups.id, groupId),
        ),
      );

    console.info(
      `[${scope}/deleteWorkspaceButtonTemplateGroup] Success: workspaceId=${workspaceId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/deleteWorkspaceButtonTemplateGroup] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

async function stripButtonTemplateGroupIdFromAgents(
  workspaceId: string,
  groupId: string,
): Promise<void> {
  const { listAgentConfigs } = await import("./agent.js");
  const agents = await listAgentConfigs(workspaceId);

  for (const agent of agents) {
    const current = normalizeButtonTemplateGroupIds(agent.button_template_groups);
    if (!current.includes(groupId)) continue;

    const next = current.filter((id) => id !== groupId);

    try {
      await db
        .update(agentConfigs)
        .set({ buttonTemplateGroups: next })
        .where(
          and(
            eq(agentConfigs.id, agent.id),
            eq(agentConfigs.workspaceId, workspaceId),
            isNull(agentConfigs.archivedAt),
          ),
        );
    } catch (error) {
      console.error(
        `[${scope}/stripButtonTemplateGroupIdFromAgents] Failed query: ${String(error)}`,
      );
    }
  }

  console.info(
    `[${scope}/stripButtonTemplateGroupIdFromAgents] Success: workspaceId=${workspaceId}`,
  );
}

export async function validateButtonTemplateGroupIdsForWorkspace(
  workspaceId: string,
  ids: string[],
): Promise<{ ok: true; normalized: string[] } | { ok: false; message: string }> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) {
    return { ok: true, normalized: [] };
  }

  try {
    const data = await db
      .select({ id: workspaceButtonTemplateGroups.id })
      .from(workspaceButtonTemplateGroups)
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, workspaceId),
          inArray(workspaceButtonTemplateGroups.id, unique),
        ),
      );

    const found = new Set(data.map((r) => r.id));
    for (const id of unique) {
      if (!found.has(id)) {
        return { ok: false, message: "Unknown button template group." };
      }
    }

    console.info(
      `[${scope}/validateButtonTemplateGroupIdsForWorkspace] Success: workspaceId=${workspaceId}`,
    );
    return { ok: true, normalized: unique };
  } catch (error) {
    console.error(
      `[${scope}/validateButtonTemplateGroupIdsForWorkspace] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

export type ButtonTemplateGroupForInstructions = {
  id: string;
  name: string;
  entries: { id: string; title: string; body: string; buttons: ButtonTemplateButton[] }[];
};

/** Ordered list of attached groups + entries for prompt injection. */
export async function listButtonTemplatesForInstructions(
  workspaceId: string,
  groupIds: string[],
): Promise<ButtonTemplateGroupForInstructions[]> {
  if (groupIds.length === 0) return [];

  try {
    const groups = await db
      .select({
        id: workspaceButtonTemplateGroups.id,
        name: workspaceButtonTemplateGroups.name,
      })
      .from(workspaceButtonTemplateGroups)
      .where(
        and(
          eq(workspaceButtonTemplateGroups.workspaceId, workspaceId),
          inArray(workspaceButtonTemplateGroups.id, groupIds),
        ),
      );

    if (groups.length === 0) {
      return [];
    }

    const entries = await db
      .select({
        id: workspaceButtonTemplateEntries.id,
        groupId: workspaceButtonTemplateEntries.groupId,
        title: workspaceButtonTemplateEntries.title,
        body: workspaceButtonTemplateEntries.body,
        buttons: workspaceButtonTemplateEntries.buttons,
        sortOrder: workspaceButtonTemplateEntries.sortOrder,
      })
      .from(workspaceButtonTemplateEntries)
      .where(inArray(workspaceButtonTemplateEntries.groupId, groupIds));

    const byGroup = new Map<string, typeof entries>();
    for (const row of entries) {
      const bucket = byGroup.get(row.groupId) ?? [];
      bucket.push(row);
      byGroup.set(row.groupId, bucket);
    }

    const result: ButtonTemplateGroupForInstructions[] = [];
    const idToName = new Map(groups.map((x) => [x.id, x.name]));

    for (const gid of groupIds) {
      const name = idToName.get(gid);
      if (!name) continue;

      const rowsByGroup = (byGroup.get(gid) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );

      result.push({
        id: gid,
        name,
        entries: rowsByGroup.map((x) => ({
          id: x.id,
          title: x.title,
          body: x.body,
          buttons: parseButtonTemplateButtons(x.buttons) ?? [],
        })),
      });
    }

    console.info(
      `[${scope}/listButtonTemplatesForInstructions] Success: workspaceId=${workspaceId}`,
    );
    return result;
  } catch (error) {
    console.error(
      `[${scope}/listButtonTemplatesForInstructions] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

/**
 * Load one button template for sending, scoped to the workspace and the
 * agent's attached groups. Returns null when the template does not exist,
 * is not attached, or its buttons are unreadable.
 */
export async function getWorkspaceButtonTemplateForSend(
  workspaceId: string,
  groupIds: string[],
  entryId: string,
): Promise<{
  id: string;
  groupId: string;
  title: string;
  body: string;
  buttons: ButtonTemplateButton[];
} | null> {
  if (groupIds.length === 0) return null;

  try {
    const rows = await db
      .select({
        id: workspaceButtonTemplateEntries.id,
        groupId: workspaceButtonTemplateEntries.groupId,
        title: workspaceButtonTemplateEntries.title,
        body: workspaceButtonTemplateEntries.body,
        buttons: workspaceButtonTemplateEntries.buttons,
      })
      .from(workspaceButtonTemplateEntries)
      .innerJoin(
        workspaceButtonTemplateGroups,
        eq(workspaceButtonTemplateEntries.groupId, workspaceButtonTemplateGroups.id),
      )
      .where(
        and(
          eq(workspaceButtonTemplateEntries.id, entryId),
          eq(workspaceButtonTemplateGroups.workspaceId, workspaceId),
          inArray(workspaceButtonTemplateGroups.id, groupIds),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      console.error(
        `[${scope}/getWorkspaceButtonTemplateForSend] Failed query: template not found entryId=${entryId}`,
      );
      return null;
    }

    const buttons = parseButtonTemplateButtons(row.buttons);
    if (!buttons || buttons.length === 0) {
      console.error(
        `[${scope}/getWorkspaceButtonTemplateForSend] Failed query: unusable buttons entryId=${entryId}`,
      );
      return null;
    }

    console.info(
      `[${scope}/getWorkspaceButtonTemplateForSend] Success: workspaceId=${workspaceId} entryId=${entryId}`,
    );
    return {
      id: row.id,
      groupId: row.groupId,
      title: row.title,
      body: row.body,
      buttons,
    };
  } catch (error) {
    console.error(
      `[${scope}/getWorkspaceButtonTemplateForSend] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export function normalizeButtonTemplateGroupIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}

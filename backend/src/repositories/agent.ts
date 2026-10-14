import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { agentConfigs } from "../db/schema/index.js";
import type { AgentConfigRecord } from "../types/repositories.js";

const scope = "AgentRepository";

function parseResponseTemplateGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

function parseHandoffTopicGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

function parseContextGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

function parseAssetGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

function parseHandoffNotifyUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
}

type AgentConfigRow = {
  id: string;
  profileName: string;
  behavior: string;
  tools: unknown;
  skills: unknown;
  updatedAt: Date;
  firstUsedAt: Date | null;
  autoAssignConversationLabels: boolean | null;
  responseTemplateGroups: unknown;
  handoffTopicGroups: unknown;
  contextGroups: unknown;
  assetGroups: unknown;
  handoffNotifyUserIds: unknown;
};

function mapAgentConfigRow(row: AgentConfigRow): AgentConfigRecord {
  const tools = Array.isArray(row.tools) ? row.tools.map(String) : [];
  const skills = Array.isArray(row.skills) ? row.skills.map(String) : [];
  return {
    id: row.id,
    profile_name: row.profileName,
    behavior: row.behavior,
    tools,
    skills,
    updated_at: row.updatedAt.toISOString(),
    first_used_at: row.firstUsedAt?.toISOString() ?? null,
    auto_assign_conversation_labels: row.autoAssignConversationLabels !== false,
    response_template_groups: parseResponseTemplateGroupIds(row.responseTemplateGroups),
    handoff_topic_groups: parseHandoffTopicGroupIds(row.handoffTopicGroups),
    context_groups: parseContextGroupIds(row.contextGroups),
    asset_groups: parseAssetGroupIds(row.assetGroups),
    handoff_notify_user_ids: parseHandoffNotifyUserIds(row.handoffNotifyUserIds),
  };
}

export async function listAgentConfigs(workspaceId: string): Promise<AgentConfigRecord[]> {
  try {
    const rows = await db
      .select({
        id: agentConfigs.id,
        profileName: agentConfigs.profileName,
        behavior: agentConfigs.behavior,
        tools: agentConfigs.tools,
        skills: agentConfigs.skills,
        updatedAt: agentConfigs.updatedAt,
        firstUsedAt: agentConfigs.firstUsedAt,
        autoAssignConversationLabels: agentConfigs.autoAssignConversationLabels,
        responseTemplateGroups: agentConfigs.responseTemplateGroups,
        handoffTopicGroups: agentConfigs.handoffTopicGroups,
        contextGroups: agentConfigs.contextGroups,
        assetGroups: agentConfigs.assetGroups,
        handoffNotifyUserIds: agentConfigs.handoffNotifyUserIds,
      })
      .from(agentConfigs)
      .where(
        and(
          eq(agentConfigs.workspaceId, workspaceId),
          isNull(agentConfigs.archivedAt),
        ),
      )
      .orderBy(desc(agentConfigs.updatedAt));

    console.info(`[${scope}/listAgentConfigs] Success: userId=${workspaceId}`);
    return rows.map(mapAgentConfigRow);
  } catch (error) {
    console.error(`[${scope}/listAgentConfigs] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getAgentConfigById(
  workspaceId: string,
  agentConfigId: string,
): Promise<AgentConfigRecord | null> {
  try {
    const rows = await db
      .select({
        id: agentConfigs.id,
        profileName: agentConfigs.profileName,
        behavior: agentConfigs.behavior,
        tools: agentConfigs.tools,
        skills: agentConfigs.skills,
        updatedAt: agentConfigs.updatedAt,
        firstUsedAt: agentConfigs.firstUsedAt,
        autoAssignConversationLabels: agentConfigs.autoAssignConversationLabels,
        responseTemplateGroups: agentConfigs.responseTemplateGroups,
        handoffTopicGroups: agentConfigs.handoffTopicGroups,
        contextGroups: agentConfigs.contextGroups,
        assetGroups: agentConfigs.assetGroups,
        handoffNotifyUserIds: agentConfigs.handoffNotifyUserIds,
      })
      .from(agentConfigs)
      .where(
        and(
          eq(agentConfigs.workspaceId, workspaceId),
          eq(agentConfigs.id, agentConfigId),
          isNull(agentConfigs.archivedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      console.error(`[${scope}/getAgentConfigById] Failed query: config not found`);
      return null;
    }

    console.info(`[${scope}/getAgentConfigById] Success: userId=${workspaceId}`);
    return mapAgentConfigRow(rows[0]);
  } catch (error) {
    console.error(`[${scope}/getAgentConfigById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createAgentConfig(payload: {
  workspace_id: string;
  profile_name: string;
}): Promise<{ ok: boolean; message: string; id: string | null }> {
  try {
    const rows = await db
      .insert(agentConfigs)
      .values({
        workspaceId: payload.workspace_id,
        profileName: payload.profile_name,
      })
      .returning({ id: agentConfigs.id });

    console.info(`[${scope}/createAgentConfig] Success: userId=${payload.workspace_id}`);
    return { ok: true, message: "Agent created", id: rows[0].id as string };
  } catch (error) {
    console.error(`[${scope}/createAgentConfig] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error", id: null as string | null };
  }
}

export async function updateAgentConfig(payload: {
  id: string;
  workspace_id: string;
  profile_name: string;
  behavior: string;
  tools: string[];
  skills: string[];
  auto_assign_conversation_labels: boolean;
  response_template_groups: string[];
  handoff_topic_groups: string[];
  context_groups: string[];
  asset_groups: string[];
  handoff_notify_user_ids: string[];
}): Promise<{ ok: boolean; message: string }> {
  try {
    await db
      .update(agentConfigs)
      .set({
        profileName: payload.profile_name,
        behavior: payload.behavior,
        tools: payload.tools,
        skills: payload.skills,
        autoAssignConversationLabels: payload.auto_assign_conversation_labels,
        responseTemplateGroups: payload.response_template_groups,
        handoffTopicGroups: payload.handoff_topic_groups,
        contextGroups: payload.context_groups,
        assetGroups: payload.asset_groups,
        handoffNotifyUserIds: payload.handoff_notify_user_ids,
      })
      .where(
        and(
          eq(agentConfigs.id, payload.id),
          eq(agentConfigs.workspaceId, payload.workspace_id),
          isNull(agentConfigs.archivedAt),
        ),
      );

    console.info(`[${scope}/updateAgentConfig] Success: userId=${payload.workspace_id}`);
    return { ok: true, message: "Agent settings saved" };
  } catch (error) {
    console.error(`[${scope}/updateAgentConfig] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function markAgentConfigFirstUsed(workspaceId: string, agentConfigId: string): Promise<void> {
  try {
    await db
      .update(agentConfigs)
      .set({ firstUsedAt: new Date() })
      .where(
        and(
          eq(agentConfigs.id, agentConfigId),
          eq(agentConfigs.workspaceId, workspaceId),
          isNull(agentConfigs.archivedAt),
          isNull(agentConfigs.firstUsedAt),
        ),
      );

    console.info(`[${scope}/markAgentConfigFirstUsed] Success: userId=${workspaceId}`);
  } catch (error) {
    console.error(`[${scope}/markAgentConfigFirstUsed] Unexpected error: ${String(error)}`);
  }
}

export async function archiveAgentConfig(input: {
  workspace_id: string;
  id: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db
      .update(agentConfigs)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(agentConfigs.id, input.id),
          eq(agentConfigs.workspaceId, input.workspace_id),
          isNull(agentConfigs.archivedAt),
        ),
      )
      .returning({ id: agentConfigs.id });

    if (rows.length === 0) {
      console.error(`[${scope}/archiveAgentConfig] Failed query: no matching row or already archived`);
      return { ok: false, message: "Agent not found or already archived." };
    }

    console.info(`[${scope}/archiveAgentConfig] Success: userId=${input.workspace_id}`);
    return { ok: true, message: "Agent archived" };
  } catch (error) {
    console.error(`[${scope}/archiveAgentConfig] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteAgentConfig(input: {
  workspace_id: string;
  id: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await db
      .delete(agentConfigs)
      .where(
        and(
          eq(agentConfigs.id, input.id),
          eq(agentConfigs.workspaceId, input.workspace_id),
          isNull(agentConfigs.firstUsedAt),
          isNull(agentConfigs.archivedAt),
        ),
      )
      .returning({ id: agentConfigs.id });

    if (rows.length === 0) {
      console.error(`[${scope}/deleteAgentConfig] Failed query: no matching row or agent has been used`);
      return { ok: false, message: "Agent cannot be deleted (already used or not found)." };
    }

    console.info(`[${scope}/deleteAgentConfig] Success: userId=${input.workspace_id}`);
    return { ok: true, message: "Agent deleted" };
  } catch (error) {
    console.error(`[${scope}/deleteAgentConfig] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

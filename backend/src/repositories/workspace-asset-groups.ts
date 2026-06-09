import { randomUUID } from "node:crypto";
import { eq, and, inArray, asc, sql, ilike, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaceAssetGroups,
  agentAssets,
  agentConfigs,
} from "../db/schema/index.js";
import { storageUpload, storageDownload, storageRemove, storageCreateSignedUrl } from "../lib/storage.js";
import { validateWorkspaceAssetUpload } from "../lib/workspace-asset-limits.js";
import {
  releaseWorkspaceStorage,
  reserveWorkspaceStorage,
} from "../repositories/workspace-storage.js";
import type {
  AgentAssetRecord,
  WorkspaceAssetGroupSummary,
  WorkspaceAssetGroupWithAssets,
} from "../types/repositories.js";

const scope = "WorkspaceAssetGroupsRepository";
export const ASSET_GROUP_NAME_MAX_LEN = 120;
export const ASSET_GROUPS_MAX_WORKSPACE = 40;
export const ASSETS_MAX_PER_GROUP = 40;

function buildStoragePath(workspaceId: string, groupId: string, assetId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "asset";
  return `${workspaceId}/${groupId}/${assetId}/${safeName}`;
}

function normalizeAssetGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

async function attachSignedUrls(assets: AgentAssetRecord[]): Promise<AgentAssetRecord[]> {
  const withUrls: AgentAssetRecord[] = [];
  for (const row of assets) {
    const url = await storageCreateSignedUrl("agent-assets", row.storage_path, 60 * 60);
    withUrls.push({ ...row, preview_url: url ?? null });
  }
  return withUrls;
}

export async function listWorkspaceAssetGroupSummaries(
  workspaceId: string,
): Promise<WorkspaceAssetGroupSummary[]> {
  try {
    const groups = await db
      .select({
        id: workspaceAssetGroups.id,
        name: workspaceAssetGroups.name,
        updatedAt: workspaceAssetGroups.updatedAt,
      })
      .from(workspaceAssetGroups)
      .where(eq(workspaceAssetGroups.workspaceId, workspaceId))
      .orderBy(sql`${workspaceAssetGroups.name} asc`);

    if (groups.length === 0) {
      console.info(`[${scope}/listWorkspaceAssetGroupSummaries] Success: workspaceId=${workspaceId}`);
      return [];
    }

    const groupIds = groups.map((g) => g.id);

    const counts = await db
      .select({ groupId: agentAssets.groupId })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, workspaceId),
          inArray(agentAssets.groupId, groupIds),
        ),
      );

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.groupId, (countMap.get(row.groupId) ?? 0) + 1);
    }

    console.info(`[${scope}/listWorkspaceAssetGroupSummaries] Success: workspaceId=${workspaceId}`);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      updated_at: g.updatedAt.toISOString(),
      asset_count: countMap.get(g.id) ?? 0,
    }));
  } catch (error) {
    console.error(`[${scope}/listWorkspaceAssetGroupSummaries] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getWorkspaceAssetGroupDetail(
  workspaceId: string,
  groupId: string,
): Promise<WorkspaceAssetGroupWithAssets | null> {
  try {
    const [group] = await db
      .select({
        id: workspaceAssetGroups.id,
        name: workspaceAssetGroups.name,
        updatedAt: workspaceAssetGroups.updatedAt,
      })
      .from(workspaceAssetGroups)
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, workspaceId),
          eq(workspaceAssetGroups.id, groupId),
        ),
      )
      .limit(1);

    if (!group) {
      console.error(`[${scope}/getWorkspaceAssetGroupDetail] Failed query: group not found`);
      return null;
    }

    const rows = await db
      .select({
        id: agentAssets.id,
        workspaceId: agentAssets.workspaceId,
        groupId: agentAssets.groupId,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        mimeType: agentAssets.mimeType,
        description: agentAssets.description,
        fileSizeBytes: agentAssets.fileSizeBytes,
        sortOrder: agentAssets.sortOrder,
        createdAt: agentAssets.createdAt,
        updatedAt: agentAssets.updatedAt,
      })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, workspaceId),
          eq(agentAssets.groupId, groupId),
        ),
      )
      .orderBy(asc(agentAssets.sortOrder), asc(agentAssets.createdAt));

    const assets: AgentAssetRecord[] = rows.map((r) => ({
      id: r.id,
      workspace_id: r.workspaceId,
      group_id: r.groupId,
      file_name: r.fileName,
      storage_path: r.storagePath,
      mime_type: r.mimeType,
      description: r.description,
      file_size_bytes: r.fileSizeBytes,
      sort_order: r.sortOrder,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    }));

    const withUrls = await attachSignedUrls(assets);
    console.info(`[${scope}/getWorkspaceAssetGroupDetail] Success: workspaceId=${workspaceId}`);
    return {
      id: group.id,
      name: group.name,
      updated_at: group.updatedAt.toISOString(),
      assets: withUrls,
    };
  } catch (error) {
    console.error(`[${scope}/getWorkspaceAssetGroupDetail] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createWorkspaceAssetGroup(
  workspaceId: string,
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const nameTrimmed = name.trim();
  if (nameTrimmed.length === 0) return { ok: false, message: "Group name is required." };
  if (nameTrimmed.length > ASSET_GROUP_NAME_MAX_LEN) {
    return { ok: false, message: `Group name is too long (max ${ASSET_GROUP_NAME_MAX_LEN} characters).` };
  }
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceAssetGroups)
      .where(eq(workspaceAssetGroups.workspaceId, workspaceId));

    const count = row?.count ?? 0;

    if (count >= ASSET_GROUPS_MAX_WORKSPACE) {
      return { ok: false, message: `At most ${ASSET_GROUPS_MAX_WORKSPACE} asset groups per workspace.` };
    }

    const [inserted] = await db
      .insert(workspaceAssetGroups)
      .values({ workspaceId, name: nameTrimmed })
      .returning({ id: workspaceAssetGroups.id });

    if (!inserted) {
      console.error(`[${scope}/createWorkspaceAssetGroup] Failed query: insert returned no row`);
      return { ok: false, message: "Insert failed." };
    }

    console.info(`[${scope}/createWorkspaceAssetGroup] Success: workspaceId=${workspaceId}`);
    return { ok: true, id: inserted.id };
  } catch (error) {
    console.error(`[${scope}/createWorkspaceAssetGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateWorkspaceAssetGroupName(payload: {
  workspaceId: string;
  groupId: string;
  name: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const nameTrimmed = payload.name.trim();
  if (nameTrimmed.length === 0) return { ok: false, message: "Group name is required." };
  if (nameTrimmed.length > ASSET_GROUP_NAME_MAX_LEN) {
    return { ok: false, message: `Group name is too long (max ${ASSET_GROUP_NAME_MAX_LEN} characters).` };
  }
  try {
    await db
      .update(workspaceAssetGroups)
      .set({ name: nameTrimmed, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, payload.workspaceId),
          eq(workspaceAssetGroups.id, payload.groupId),
        ),
      );

    console.info(`[${scope}/updateWorkspaceAssetGroupName] Success: workspaceId=${payload.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateWorkspaceAssetGroupName] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

async function stripAssetGroupIdFromAgents(workspaceId: string, groupId: string): Promise<void> {
  const { listAgentConfigs } = await import("./agent.js");
  const agents = await listAgentConfigs(workspaceId);
  for (const agent of agents) {
    const current = normalizeAssetGroupIds(agent.asset_groups);
    if (!current.includes(groupId)) continue;
    const next = current.filter((id) => id !== groupId);
    try {
      await db
        .update(agentConfigs)
        .set({ assetGroups: next })
        .where(
          and(
            eq(agentConfigs.id, agent.id),
            eq(agentConfigs.workspaceId, workspaceId),
            isNull(agentConfigs.archivedAt),
          ),
        );
    } catch (error) {
      console.error(`[${scope}/stripAssetGroupIdFromAgents] Failed query: ${String(error)}`);
    }
  }
  console.info(`[${scope}/stripAssetGroupIdFromAgents] Success: workspaceId=${workspaceId}`);
}

export async function deleteWorkspaceAssetGroup(
  workspaceId: string,
  groupId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const rows = await db
      .select({
        storagePath: agentAssets.storagePath,
        fileSizeBytes: agentAssets.fileSizeBytes,
      })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, workspaceId),
          eq(agentAssets.groupId, groupId),
        ),
      );

    const bytesToRelease = rows.reduce(
      (acc, row) => acc + (row.fileSizeBytes ?? 0),
      0,
    );

    await stripAssetGroupIdFromAgents(workspaceId, groupId);

    await db
      .delete(workspaceAssetGroups)
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, workspaceId),
          eq(workspaceAssetGroups.id, groupId),
        ),
      );

    const paths = rows
      .map((r) => r.storagePath ?? "")
      .filter(Boolean);
    if (paths.length > 0) {
      await storageRemove("agent-assets", paths);
    }
    if (bytesToRelease > 0) {
      await releaseWorkspaceStorage(workspaceId, "asset", bytesToRelease);
    }
    console.info(`[${scope}/deleteWorkspaceAssetGroup] Success: workspaceId=${workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteWorkspaceAssetGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function validateAssetGroupIdsForWorkspace(
  workspaceId: string,
  ids: string[],
): Promise<{ ok: true; normalized: string[] } | { ok: false; message: string }> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return { ok: true, normalized: [] };
  try {
    const data = await db
      .select({ id: workspaceAssetGroups.id })
      .from(workspaceAssetGroups)
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, workspaceId),
          inArray(workspaceAssetGroups.id, unique),
        ),
      );

    const found = new Set(data.map((r) => r.id));
    for (const id of unique) {
      if (!found.has(id)) return { ok: false, message: "Unknown workspace asset group." };
    }
    console.info(`[${scope}/validateAssetGroupIdsForWorkspace] Success: workspaceId=${workspaceId}`);
    return { ok: true, normalized: unique };
  } catch (error) {
    console.error(`[${scope}/validateAssetGroupIdsForWorkspace] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export type AssetGroupForInstructions = {
  name: string;
  assets: { file_name: string; description: string }[];
};

export async function listWorkspaceAssetsForInstructions(
  workspaceId: string,
  groupIds: string[],
): Promise<AssetGroupForInstructions[]> {
  if (groupIds.length === 0) return [];
  try {
    const groups = await db
      .select({
        id: workspaceAssetGroups.id,
        name: workspaceAssetGroups.name,
      })
      .from(workspaceAssetGroups)
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, workspaceId),
          inArray(workspaceAssetGroups.id, groupIds),
        ),
      );

    if (groups.length === 0) {
      console.info(`[${scope}/listWorkspaceAssetsForInstructions] Success: workspaceId=${workspaceId}`);
      return [];
    }

    const assets = await db
      .select({
        groupId: agentAssets.groupId,
        fileName: agentAssets.fileName,
        description: agentAssets.description,
      })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, workspaceId),
          inArray(agentAssets.groupId, groupIds),
        ),
      )
      .orderBy(asc(agentAssets.sortOrder), asc(agentAssets.createdAt));

    const byGroup = new Map<string, typeof assets>();
    for (const row of assets) {
      const bucket = byGroup.get(row.groupId) ?? [];
      bucket.push(row);
      byGroup.set(row.groupId, bucket);
    }

    const result: AssetGroupForInstructions[] = [];
    const idToName = new Map(groups.map((g) => [g.id, g.name]));

    for (const gid of groupIds) {
      const name = idToName.get(gid);
      if (!name) continue;
      const rowsByGroup = byGroup.get(gid) ?? [];
      result.push({
        name,
        assets: rowsByGroup.map((r) => ({
          file_name: r.fileName,
          description: r.description,
        })),
      });
    }

    console.info(`[${scope}/listWorkspaceAssetsForInstructions] Success: workspaceId=${workspaceId}`);
    return result;
  } catch (error) {
    console.error(`[${scope}/listWorkspaceAssetsForInstructions] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getAgentAssetByFileNameForAgent(
  workspaceId: string,
  groupIds: string[],
  fileName: string,
): Promise<AgentAssetRecord | null> {
  const normalized = fileName.trim();
  if (!normalized || groupIds.length === 0) return null;
  try {
    const [data] = await db
      .select({
        id: agentAssets.id,
        workspaceId: agentAssets.workspaceId,
        groupId: agentAssets.groupId,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        mimeType: agentAssets.mimeType,
        description: agentAssets.description,
        fileSizeBytes: agentAssets.fileSizeBytes,
        sortOrder: agentAssets.sortOrder,
        createdAt: agentAssets.createdAt,
        updatedAt: agentAssets.updatedAt,
      })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, workspaceId),
          inArray(agentAssets.groupId, groupIds),
          ilike(agentAssets.fileName, normalized),
        ),
      )
      .limit(1);

    if (!data) {
      console.error(`[${scope}/getAgentAssetByFileNameForAgent] Failed query: asset not found`);
      return null;
    }

    console.info(`[${scope}/getAgentAssetByFileNameForAgent] Success: workspaceId=${workspaceId}`);
    return {
      id: data.id,
      workspace_id: data.workspaceId,
      group_id: data.groupId,
      file_name: data.fileName,
      storage_path: data.storagePath,
      mime_type: data.mimeType,
      description: data.description,
      file_size_bytes: data.fileSizeBytes,
      sort_order: data.sortOrder,
      created_at: data.createdAt.toISOString(),
      updated_at: data.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error(`[${scope}/getAgentAssetByFileNameForAgent] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function downloadAgentAssetBytes(storagePath: string): Promise<ArrayBuffer | null> {
  try {
    const data = await storageDownload("agent-assets", storagePath);
    if (!data) {
      console.error(`[${scope}/downloadAgentAssetBytes] Failed query: no data`);
      return null;
    }
    console.info(`[${scope}/downloadAgentAssetBytes] Success`);
    return data.buffer as ArrayBuffer;
  } catch (error) {
    console.error(`[${scope}/downloadAgentAssetBytes] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createAgentAssetInGroup(input: {
  workspaceId: string;
  groupId: string;
  fileName: string;
  mimeType: string;
  description: string;
  data: ArrayBuffer;
}): Promise<{ ok: boolean; message: string; asset?: AgentAssetRecord }> {
  const fileName = input.fileName.trim();
  const description = input.description.trim().slice(0, 2000);
  const mimeType = input.mimeType || "application/octet-stream";
  const validated = validateWorkspaceAssetUpload({
    fileName,
    mimeType,
    byteLength: input.data.byteLength,
  });
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const reserved = await reserveWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
  if (!reserved.ok) {
    return { ok: false, message: reserved.message };
  }

  let storagePath = "";
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, input.workspaceId),
          eq(agentAssets.groupId, input.groupId),
        ),
      );

    const count = row?.count ?? 0;

    if (count >= ASSETS_MAX_PER_GROUP) {
      await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
      return { ok: false, message: `At most ${ASSETS_MAX_PER_GROUP} files per group.` };
    }

    const assetId = randomUUID();
    storagePath = buildStoragePath(input.workspaceId, input.groupId, assetId, fileName);

    const { error: uploadError } = await storageUpload("agent-assets", storagePath, input.data, mimeType);
    if (uploadError) {
      await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
      console.error(`[${scope}/createAgentAssetInGroup] Failed query: ${uploadError}`);
      return { ok: false, message: uploadError };
    }

    const [inserted] = await db
      .insert(agentAssets)
      .values({
        id: assetId,
        workspaceId: input.workspaceId,
        groupId: input.groupId,
        fileName,
        storagePath,
        mimeType,
        description,
        fileSizeBytes: input.data.byteLength,
        sortOrder: count,
      })
      .returning({
        id: agentAssets.id,
        workspaceId: agentAssets.workspaceId,
        groupId: agentAssets.groupId,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        mimeType: agentAssets.mimeType,
        description: agentAssets.description,
        fileSizeBytes: agentAssets.fileSizeBytes,
        sortOrder: agentAssets.sortOrder,
        createdAt: agentAssets.createdAt,
        updatedAt: agentAssets.updatedAt,
      });

    if (!inserted) {
      await storageRemove("agent-assets", [storagePath]);
      await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
      console.error(`[${scope}/createAgentAssetInGroup] Failed query: insert returned no row`);
      return { ok: false, message: "Insert failed." };
    }

    await db
      .update(workspaceAssetGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, input.workspaceId),
          eq(workspaceAssetGroups.id, input.groupId),
        ),
      );

    console.info(`[${scope}/createAgentAssetInGroup] Success: workspaceId=${input.workspaceId}`);
    return {
      ok: true,
      message: "Asset uploaded",
      asset: {
        id: inserted.id,
        workspace_id: inserted.workspaceId,
        group_id: inserted.groupId,
        file_name: inserted.fileName,
        storage_path: inserted.storagePath,
        mime_type: inserted.mimeType,
        description: inserted.description,
        file_size_bytes: inserted.fileSizeBytes,
        sort_order: inserted.sortOrder,
        created_at: inserted.createdAt.toISOString(),
        updated_at: inserted.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    if (storagePath) {
      await storageRemove("agent-assets", [storagePath]);
    }
    await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
    console.error(`[${scope}/createAgentAssetInGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateAgentAssetDescription(input: {
  workspaceId: string;
  groupId: string;
  assetId: string;
  description: string;
}): Promise<{ ok: boolean; message: string }> {
  const description = input.description.trim().slice(0, 2000);
  try {
    await db
      .update(agentAssets)
      .set({ description, updatedAt: new Date() })
      .where(
        and(
          eq(agentAssets.id, input.assetId),
          eq(agentAssets.workspaceId, input.workspaceId),
          eq(agentAssets.groupId, input.groupId),
        ),
      );

    await db
      .update(workspaceAssetGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, input.workspaceId),
          eq(workspaceAssetGroups.id, input.groupId),
        ),
      );

    console.info(`[${scope}/updateAgentAssetDescription] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Description saved" };
  } catch (error) {
    console.error(`[${scope}/updateAgentAssetDescription] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function deleteAgentAssetFromGroup(input: {
  workspaceId: string;
  groupId: string;
  assetId: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const [row] = await db
      .select({
        storagePath: agentAssets.storagePath,
        fileSizeBytes: agentAssets.fileSizeBytes,
      })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.id, input.assetId),
          eq(agentAssets.workspaceId, input.workspaceId),
          eq(agentAssets.groupId, input.groupId),
        ),
      )
      .limit(1);

    if (!row) return { ok: false, message: "Asset not found." };

    const fileSizeBytes = row.fileSizeBytes ?? 0;

    await db
      .delete(agentAssets)
      .where(
        and(
          eq(agentAssets.id, input.assetId),
          eq(agentAssets.workspaceId, input.workspaceId),
          eq(agentAssets.groupId, input.groupId),
        ),
      );

    const storagePath = row.storagePath ?? "";
    if (storagePath) await storageRemove("agent-assets", [storagePath]);
    if (fileSizeBytes > 0) {
      await releaseWorkspaceStorage(input.workspaceId, "asset", fileSizeBytes);
    }

    await db
      .update(workspaceAssetGroups)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, input.workspaceId),
          eq(workspaceAssetGroups.id, input.groupId),
        ),
      );

    console.info(`[${scope}/deleteAgentAssetFromGroup] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Asset deleted" };
  } catch (error) {
    console.error(`[${scope}/deleteAgentAssetFromGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}
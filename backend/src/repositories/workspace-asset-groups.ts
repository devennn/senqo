import { randomUUID } from "node:crypto";
import { eq, and, inArray, asc, sql, ilike, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  workspaceAssetGroups,
  agentAssets,
  agentConfigs,
} from "../db/schema/index.js";
import { storageUpload, storageDownload, storageRemove, storageCreateSignedUrl } from "../lib/storage.js";
import { googleDriveOpenUrl } from "../lib/google-drive-open-url.js";
import { validateWorkspaceAssetUpload } from "../lib/workspace-asset-limits.js";
import {
  releaseWorkspaceStorage,
  reserveWorkspaceStorage,
} from "../repositories/workspace-storage.js";
import type {
  AgentAssetKind,
  AgentAssetRecord,
  AgentAssetSource,
  WorkspaceAssetGroupSummary,
  WorkspaceAssetGroupWithAssets,
} from "../types/repositories.js";

const scope = "WorkspaceAssetGroupsRepository";
export const ASSET_GROUP_NAME_MAX_LEN = 120;
export const ASSET_GROUPS_MAX_WORKSPACE = 40;
export const ASSETS_MAX_PER_GROUP = 40;

/** Sendable files live in the agent-assets bucket; live docs keep the linked-docs bucket. */
const FILE_BUCKET = "agent-assets";
const DOC_BUCKET = "linked-docs";

/** Live doc upload limits (same rules the standalone Docs feature used). */
export const DOC_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const DOC_UPLOAD_ALLOWED_EXT = new Set([
  ".pdf",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
]);

const FOLDER_MIME = "application/vnd.google-apps.folder";

export function isFolderMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase() === FOLDER_MIME;
}

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isAllowedDocUploadFileName(fileName: string): boolean {
  return DOC_UPLOAD_ALLOWED_EXT.has(fileExtension(fileName));
}

function buildStoragePath(workspaceId: string, groupId: string, assetId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "asset";
  return `${workspaceId}/${groupId}/${assetId}/${safeName}`;
}

function buildDocStoragePath(workspaceId: string, fileName: string): string {
  const ext = fileExtension(fileName);
  return `${workspaceId}/${randomUUID()}${ext}`;
}

function normalizeAssetGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

type AssetRow = {
  id: string;
  workspaceId: string;
  groupId: string;
  kind: string;
  source: string;
  fileName: string;
  storagePath: string | null;
  driveFileId: string | null;
  mimeType: string;
  description: string;
  fileSizeBytes: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function mapAssetRow(row: AssetRow): AgentAssetRecord {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    group_id: row.groupId,
    kind: row.kind as AgentAssetKind,
    source: row.source as AgentAssetSource,
    file_name: row.fileName,
    storage_path: row.storagePath,
    drive_file_id: row.driveFileId,
    mime_type: row.mimeType,
    description: row.description,
    file_size_bytes: row.fileSizeBytes,
    sort_order: row.sortOrder,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Files get a signed preview URL; live docs get an open link (Drive URL or signed upload URL). */
async function attachAssetUrls(assets: AgentAssetRecord[]): Promise<AgentAssetRecord[]> {
  const withUrls: AgentAssetRecord[] = [];
  for (const row of assets) {
    if (row.kind === "doc") {
      const openUrl =
        row.source === "google_drive" && row.drive_file_id
          ? googleDriveOpenUrl(row.drive_file_id, row.mime_type) || null
          : row.storage_path
            ? (await storageCreateSignedUrl(DOC_BUCKET, row.storage_path, 60 * 60)) ?? null
            : null;
      withUrls.push({ ...row, preview_url: null, open_url: openUrl });
      continue;
    }
    const url = row.storage_path
      ? await storageCreateSignedUrl(FILE_BUCKET, row.storage_path, 60 * 60)
      : null;
    withUrls.push({ ...row, preview_url: url ?? null, open_url: null });
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
        kind: agentAssets.kind,
        source: agentAssets.source,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        driveFileId: agentAssets.driveFileId,
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

    const assets = rows.map(mapAssetRow);
    const withUrls = await attachAssetUrls(assets);
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
        kind: agentAssets.kind,
        source: agentAssets.source,
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

    const bytesToRelease = rows
      .filter((row) => row.kind === "file" && row.source === "upload")
      .reduce((acc, row) => acc + (row.fileSizeBytes ?? 0), 0);

    await stripAssetGroupIdFromAgents(workspaceId, groupId);

    await db
      .delete(workspaceAssetGroups)
      .where(
        and(
          eq(workspaceAssetGroups.workspaceId, workspaceId),
          eq(workspaceAssetGroups.id, groupId),
        ),
      );

    const filePaths = rows
      .filter((row) => row.kind === "file")
      .map((r) => r.storagePath ?? "")
      .filter(Boolean);
    const docPaths = rows
      .filter((row) => row.kind === "doc")
      .map((r) => r.storagePath ?? "")
      .filter(Boolean);
    if (filePaths.length > 0) {
      await storageRemove(FILE_BUCKET, filePaths);
    }
    if (docPaths.length > 0) {
      await storageRemove(DOC_BUCKET, docPaths);
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
          eq(agentAssets.kind, "file"),
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

export type DocAssetForInstructions = {
  id: string;
  file_name: string;
  description: string;
  source: AgentAssetSource;
};

/** Live docs inside the given groups — the readLinkedDoc allowlist and prompt list. */
export async function listWorkspaceDocAssetsForGroups(
  workspaceId: string,
  groupIds: string[],
): Promise<DocAssetForInstructions[]> {
  if (groupIds.length === 0) return [];
  try {
    const rows = await db
      .select({
        id: agentAssets.id,
        fileName: agentAssets.fileName,
        description: agentAssets.description,
        source: agentAssets.source,
      })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, workspaceId),
          inArray(agentAssets.groupId, groupIds),
          eq(agentAssets.kind, "doc"),
        ),
      )
      .orderBy(asc(agentAssets.sortOrder), asc(agentAssets.createdAt));

    console.info(`[${scope}/listWorkspaceDocAssetsForGroups] Success: workspaceId=${workspaceId}`);
    return rows.map((row) => ({
      id: row.id,
      file_name: row.fileName,
      description: row.description,
      source: row.source as AgentAssetSource,
    }));
  } catch (error) {
    console.error(`[${scope}/listWorkspaceDocAssetsForGroups] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getAgentDocAssetById(
  workspaceId: string,
  assetId: string,
): Promise<AgentAssetRecord | null> {
  try {
    const [data] = await db
      .select({
        id: agentAssets.id,
        workspaceId: agentAssets.workspaceId,
        groupId: agentAssets.groupId,
        kind: agentAssets.kind,
        source: agentAssets.source,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        driveFileId: agentAssets.driveFileId,
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
          eq(agentAssets.id, assetId),
          eq(agentAssets.kind, "doc"),
        ),
      )
      .limit(1);

    if (!data) {
      console.error(`[${scope}/getAgentDocAssetById] Failed query: doc asset not found`);
      return null;
    }

    console.info(`[${scope}/getAgentDocAssetById] Success: workspaceId=${workspaceId}`);
    return mapAssetRow(data);
  } catch (error) {
    console.error(`[${scope}/getAgentDocAssetById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function getAgentAssetInGroup(
  workspaceId: string,
  groupId: string,
  assetId: string,
): Promise<AgentAssetRecord | null> {
  try {
    const [data] = await db
      .select({
        id: agentAssets.id,
        workspaceId: agentAssets.workspaceId,
        groupId: agentAssets.groupId,
        kind: agentAssets.kind,
        source: agentAssets.source,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        driveFileId: agentAssets.driveFileId,
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
          eq(agentAssets.id, assetId),
        ),
      )
      .limit(1);

    if (!data) {
      console.error(`[${scope}/getAgentAssetInGroup] Failed query: asset not found`);
      return null;
    }

    console.info(`[${scope}/getAgentAssetInGroup] Success: workspaceId=${workspaceId}`);
    return mapAssetRow(data);
  } catch (error) {
    console.error(`[${scope}/getAgentAssetInGroup] Unexpected error: ${String(error)}`);
    return null;
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
        kind: agentAssets.kind,
        source: agentAssets.source,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        driveFileId: agentAssets.driveFileId,
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
          eq(agentAssets.kind, "file"),
          ilike(agentAssets.fileName, normalized),
        ),
      )
      .limit(1);

    if (!data) {
      console.error(`[${scope}/getAgentAssetByFileNameForAgent] Failed query: asset not found`);
      return null;
    }

    console.info(`[${scope}/getAgentAssetByFileNameForAgent] Success: workspaceId=${workspaceId}`);
    return mapAssetRow(data);
  } catch (error) {
    console.error(`[${scope}/getAgentAssetByFileNameForAgent] Unexpected error: ${String(error)}`);
    return null;
  }
}

/** Batched variant of findAgentAssetStorageByFileName for message-page hydration. */
export async function findAgentAssetStorageByFileNames(
  workspaceId: string,
  fileNames: string[],
): Promise<Map<string, { storagePath: string; mimeType: string }>> {
  const map = new Map<string, { storagePath: string; mimeType: string }>();
  const normalized = [...new Set(fileNames.map((n) => n.trim()).filter(Boolean))];
  if (normalized.length === 0) return map;
  try {
    const rows = await db
      .select({
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        mimeType: agentAssets.mimeType,
      })
      .from(agentAssets)
      .where(
        and(
          eq(agentAssets.workspaceId, workspaceId),
          eq(agentAssets.kind, "file"),
          inArray(
            sql`lower(${agentAssets.fileName})`,
            normalized.map((n) => n.toLowerCase()),
          ),
        ),
      );
    for (const row of rows) {
      if (!row.storagePath) continue;
      const key = row.fileName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { storagePath: row.storagePath, mimeType: row.mimeType });
      }
    }
    console.info(
      `[${scope}/findAgentAssetStorageByFileNames] Success: workspaceId=${workspaceId} requested=${normalized.length} resolved=${map.size}`
    );
    return map;
  } catch (error) {
    console.error(`[${scope}/findAgentAssetStorageByFileNames] Unexpected error: ${String(error)}`);
    return map;
  }
}

export async function downloadAgentAssetBytes(storagePath: string): Promise<ArrayBuffer | null> {
  try {
    const data = await storageDownload(FILE_BUCKET, storagePath);
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

async function countAssetsInGroup(workspaceId: string, groupId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentAssets)
    .where(
      and(
        eq(agentAssets.workspaceId, workspaceId),
        eq(agentAssets.groupId, groupId),
      ),
    );
  return row?.count ?? 0;
}

async function touchAssetGroup(workspaceId: string, groupId: string): Promise<void> {
  await db
    .update(workspaceAssetGroups)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(workspaceAssetGroups.workspaceId, workspaceId),
        eq(workspaceAssetGroups.id, groupId),
      ),
    );
}

/**
 * Upload a file asset. kind=file keeps the sendable-asset limits and storage quota;
 * kind=doc follows the live-doc upload rules and stores in the linked-docs bucket.
 */
export async function createAgentAssetInGroup(input: {
  workspaceId: string;
  groupId: string;
  kind?: AgentAssetKind;
  fileName: string;
  mimeType: string;
  description: string;
  data: ArrayBuffer;
}): Promise<{ ok: boolean; message: string; asset?: AgentAssetRecord }> {
  const kind: AgentAssetKind = input.kind === "doc" ? "doc" : "file";
  const fileName = input.fileName.trim();
  const description = input.description.trim().slice(0, 2000);
  const mimeType = input.mimeType || "application/octet-stream";

  if (kind === "doc") {
    if (!description) {
      return { ok: false, message: "Description is required." };
    }
    if (input.data.byteLength > DOC_UPLOAD_MAX_BYTES) {
      return { ok: false, message: "File is too large (max 20 MB)." };
    }
    if (!DOC_UPLOAD_ALLOWED_EXT.has(fileExtension(fileName))) {
      return { ok: false, message: "Unsupported file type." };
    }    if (isFolderMimeType(mimeType)) {
      return { ok: false, message: "Directories are not allowed." };
    }
  } else {
    const validated = validateWorkspaceAssetUpload({
      fileName,
      mimeType,
      byteLength: input.data.byteLength,
    });
    if (!validated.ok) {
      return { ok: false, message: validated.message };
    }
  }

  if (kind === "file") {
    const reserved = await reserveWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
    if (!reserved.ok) {
      return { ok: false, message: reserved.message };
    }
  }

  let storagePath = "";
  try {
    const count = await countAssetsInGroup(input.workspaceId, input.groupId);

    if (count >= ASSETS_MAX_PER_GROUP) {
      if (kind === "file") {
        await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
      }
      return { ok: false, message: `At most ${ASSETS_MAX_PER_GROUP} items per group.` };
    }

    const assetId = randomUUID();
    const bucket = kind === "doc" ? DOC_BUCKET : FILE_BUCKET;
    storagePath =
      kind === "doc"
        ? buildDocStoragePath(input.workspaceId, fileName)
        : buildStoragePath(input.workspaceId, input.groupId, assetId, fileName);

    const { error: uploadError } = await storageUpload(bucket, storagePath, input.data, mimeType);
    if (uploadError) {
      if (kind === "file") {
        await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
      }
      console.error(`[${scope}/createAgentAssetInGroup] Failed query: ${uploadError}`);
      return { ok: false, message: uploadError };
    }

    const [inserted] = await db
      .insert(agentAssets)
      .values({
        id: assetId,
        workspaceId: input.workspaceId,
        groupId: input.groupId,
        kind,
        source: "upload",
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
        kind: agentAssets.kind,
        source: agentAssets.source,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        driveFileId: agentAssets.driveFileId,
        mimeType: agentAssets.mimeType,
        description: agentAssets.description,
        fileSizeBytes: agentAssets.fileSizeBytes,
        sortOrder: agentAssets.sortOrder,
        createdAt: agentAssets.createdAt,
        updatedAt: agentAssets.updatedAt,
      });

    if (!inserted) {
      await storageRemove(bucket, [storagePath]);
      if (kind === "file") {
        await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
      }
      console.error(`[${scope}/createAgentAssetInGroup] Failed query: insert returned no row`);
      return { ok: false, message: "Insert failed." };
    }

    await touchAssetGroup(input.workspaceId, input.groupId);

    console.info(`[${scope}/createAgentAssetInGroup] Success: workspaceId=${input.workspaceId}`);
    return {
      ok: true,
      message: kind === "doc" ? "Live doc added" : "Asset uploaded",
      asset: mapAssetRow(inserted as AssetRow),
    };
  } catch (error) {
    if (storagePath) {
      await storageRemove(kind === "doc" ? DOC_BUCKET : FILE_BUCKET, [storagePath]);
    }
    if (kind === "file") {
      await releaseWorkspaceStorage(input.workspaceId, "asset", input.data.byteLength);
    }
    console.error(`[${scope}/createAgentAssetInGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

/** Add a live Google Drive doc to a group. Drive access checks happen at the route boundary. */
export async function createAgentDriveDocInGroup(input: {
  workspaceId: string;
  groupId: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  description: string;
}): Promise<{ ok: boolean; message: string; asset?: AgentAssetRecord }> {
  const description = input.description.trim().slice(0, 2000);
  if (!description) {
    return { ok: false, message: "Description is required." };
  }
  if (!input.driveFileId.trim()) {
    return { ok: false, message: "Drive file id is required." };
  }
  if (isFolderMimeType(input.mimeType)) {
    return { ok: false, message: "Directories are not allowed." };
  }
  try {
    const count = await countAssetsInGroup(input.workspaceId, input.groupId);

    if (count >= ASSETS_MAX_PER_GROUP) {
      return { ok: false, message: `At most ${ASSETS_MAX_PER_GROUP} items per group.` };
    }

    const [inserted] = await db
      .insert(agentAssets)
      .values({
        workspaceId: input.workspaceId,
        groupId: input.groupId,
        kind: "doc",
        source: "google_drive",
        fileName: input.fileName.trim() || "Drive file",
        storagePath: null,
        driveFileId: input.driveFileId.trim(),
        mimeType: input.mimeType.trim() || "application/octet-stream",
        description,
        fileSizeBytes: 0,
        sortOrder: count,
      })
      .returning({
        id: agentAssets.id,
        workspaceId: agentAssets.workspaceId,
        groupId: agentAssets.groupId,
        kind: agentAssets.kind,
        source: agentAssets.source,
        fileName: agentAssets.fileName,
        storagePath: agentAssets.storagePath,
        driveFileId: agentAssets.driveFileId,
        mimeType: agentAssets.mimeType,
        description: agentAssets.description,
        fileSizeBytes: agentAssets.fileSizeBytes,
        sortOrder: agentAssets.sortOrder,
        createdAt: agentAssets.createdAt,
        updatedAt: agentAssets.updatedAt,
      });

    if (!inserted) {
      console.error(`[${scope}/createAgentDriveDocInGroup] Failed query: insert returned no row`);
      return { ok: false, message: "Insert failed." };
    }

    await touchAssetGroup(input.workspaceId, input.groupId);

    console.info(`[${scope}/createAgentDriveDocInGroup] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Live doc added", asset: mapAssetRow(inserted as AssetRow) };
  } catch (error) {
    console.error(`[${scope}/createAgentDriveDocInGroup] Unexpected error: ${String(error)}`);
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

    await touchAssetGroup(input.workspaceId, input.groupId);

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
        kind: agentAssets.kind,
        source: agentAssets.source,
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
    if (storagePath) {
      await storageRemove(row.kind === "doc" ? DOC_BUCKET : FILE_BUCKET, [storagePath]);
    }
    if (row.kind === "file" && row.source === "upload" && fileSizeBytes > 0) {
      await releaseWorkspaceStorage(input.workspaceId, "asset", fileSizeBytes);
    }

    await touchAssetGroup(input.workspaceId, input.groupId);

    console.info(`[${scope}/deleteAgentAssetFromGroup] Success: workspaceId=${input.workspaceId}`);
    return { ok: true, message: "Asset deleted" };
  } catch (error) {
    console.error(`[${scope}/deleteAgentAssetFromGroup] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

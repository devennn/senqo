import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaces, agentAssets } from "../db/schema/index.js";
import type { WorkspaceStorageCategory, WorkspaceStorageUsage } from "../types/repositories.js";

const scope = "WorkspaceStorageRepository";

export async function reconcileWorkspaceStorageUsed(workspaceId: string): Promise<void> {
  try {
    const assetResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${agentAssets.fileSizeBytes}), 0)`,
      })
      .from(agentAssets)
      .where(eq(agentAssets.workspaceId, workspaceId));

    const assetTotal = assetResult[0]?.total ?? 0;

    await db
      .update(workspaces)
      .set({ storageAssetBytes: assetTotal, storageMediaBytes: 0 })
      .where(eq(workspaces.id, workspaceId));

    console.info(`[${scope}/reconcileWorkspaceStorageUsed] Success: workspaceId=${workspaceId}`);
  } catch (error) {
    console.error(`[${scope}/reconcileWorkspaceStorageUsed] Unexpected error: ${String(error)}`);
  }
}

export async function getWorkspaceStorageUsage(
  workspaceId: string,
): Promise<WorkspaceStorageUsage> {
  try {
    await reconcileWorkspaceStorageUsed(workspaceId);
    const rows = await db
      .select({
        storageAssetBytes: workspaces.storageAssetBytes,
        storageMediaBytes: workspaces.storageMediaBytes,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (rows.length === 0) {
      console.error(`[${scope}/getWorkspaceStorageUsage] Failed query: workspace not found`);
      return defaultWorkspaceStorageUsage();
    }

    const assetsBytes = Number(rows[0].storageAssetBytes ?? 0);
    const mediaBytes = Number(rows[0].storageMediaBytes ?? 0);
    const usedBytes = assetsBytes + mediaBytes;
    console.info(`[${scope}/getWorkspaceStorageUsage] Success: workspaceId=${workspaceId}`);
    return {
      usedBytes,
      breakdown: { assetsBytes, mediaBytes },
    };
  } catch (error) {
    console.error(`[${scope}/getWorkspaceStorageUsage] Unexpected error: ${String(error)}`);
    return defaultWorkspaceStorageUsage();
  }
}

function defaultWorkspaceStorageUsage(): WorkspaceStorageUsage {
  return {
    usedBytes: 0,
    breakdown: { assetsBytes: 0, mediaBytes: 0 },
  };
}

export async function reserveWorkspaceStorage(
  workspaceId: string,
  category: WorkspaceStorageCategory,
  byteLength: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (byteLength <= 0) {
    return { ok: false, message: "File is empty." };
  }
  const deltaAsset = category === "asset" ? byteLength : 0;
  const deltaMedia = category === "asset" ? 0 : byteLength;
  try {
    await db.execute(sql`
      UPDATE workspaces
      SET storage_asset_bytes = GREATEST(0, storage_asset_bytes + ${deltaAsset}),
          storage_media_bytes = GREATEST(0, storage_media_bytes + ${deltaMedia})
      WHERE id = ${workspaceId}::uuid
      RETURNING id
    `);
    console.info(`[${scope}/reserveWorkspaceStorage] Success: workspaceId=${workspaceId} category=${category}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/reserveWorkspaceStorage] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function releaseWorkspaceStorage(
  workspaceId: string,
  category: WorkspaceStorageCategory,
  byteLength: number,
): Promise<void> {
  if (byteLength <= 0) return;
  const deltaAsset = category === "asset" ? -byteLength : 0;
  const deltaMedia = category === "asset" ? 0 : -byteLength;
  try {
    await db.execute(sql`
      UPDATE workspaces
      SET storage_asset_bytes = GREATEST(0, storage_asset_bytes + ${deltaAsset}),
          storage_media_bytes = GREATEST(0, storage_media_bytes + ${deltaMedia})
      WHERE id = ${workspaceId}::uuid
    `);
    console.info(`[${scope}/releaseWorkspaceStorage] Success: workspaceId=${workspaceId} category=${category}`);
  } catch (error) {
    console.error(`[${scope}/releaseWorkspaceStorage] Unexpected error: ${String(error)}`);
  }
}

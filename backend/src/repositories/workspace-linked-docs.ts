import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { workspaceLinkedDocs } from "../db/schema/index.js";

const scope = "WorkspaceLinkedDocsRepository";

export type LinkedDocSource = "upload" | "google_drive";

export type WorkspaceLinkedDocRecord = {
  id: string;
  workspace_id: string;
  source: LinkedDocSource;
  file_name: string;
  mime_type: string;
  description: string;
  drive_file_id: string | null;
  storage_path: string | null;
  file_size_bytes: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

function mapRow(
  row: typeof workspaceLinkedDocs.$inferSelect,
): WorkspaceLinkedDocRecord {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    source: row.source as LinkedDocSource,
    file_name: row.fileName,
    mime_type: row.mimeType,
    description: row.description,
    drive_file_id: row.driveFileId,
    storage_path: row.storagePath,
    file_size_bytes: row.fileSizeBytes,
    created_by_user_id: row.createdByUserId,
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updated_at:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
  };
}

export function isFolderMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase() === FOLDER_MIME;
}

export async function listWorkspaceLinkedDocs(
  workspaceId: string,
): Promise<WorkspaceLinkedDocRecord[]> {
  try {
    const rows = await db
      .select()
      .from(workspaceLinkedDocs)
      .where(eq(workspaceLinkedDocs.workspaceId, workspaceId))
      .orderBy(desc(workspaceLinkedDocs.updatedAt), asc(workspaceLinkedDocs.fileName));
    console.info(
      `[${scope}/listWorkspaceLinkedDocs] Success: workspaceId=${workspaceId} count=${rows.length}`,
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error(
      `[${scope}/listWorkspaceLinkedDocs] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function listWorkspaceLinkedDocsByIds(
  workspaceId: string,
  ids: string[],
): Promise<WorkspaceLinkedDocRecord[]> {
  if (ids.length === 0) return [];
  try {
    const rows = await db
      .select()
      .from(workspaceLinkedDocs)
      .where(
        and(
          eq(workspaceLinkedDocs.workspaceId, workspaceId),
          inArray(workspaceLinkedDocs.id, ids),
        ),
      );
    console.info(
      `[${scope}/listWorkspaceLinkedDocsByIds] Success: workspaceId=${workspaceId} count=${rows.length}`,
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error(
      `[${scope}/listWorkspaceLinkedDocsByIds] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function getWorkspaceLinkedDocById(
  workspaceId: string,
  docId: string,
): Promise<WorkspaceLinkedDocRecord | null> {
  try {
    const rows = await db
      .select()
      .from(workspaceLinkedDocs)
      .where(
        and(
          eq(workspaceLinkedDocs.workspaceId, workspaceId),
          eq(workspaceLinkedDocs.id, docId),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      console.info(
        `[${scope}/getWorkspaceLinkedDocById] Failed query: not found id=${docId}`,
      );
      return null;
    }
    console.info(`[${scope}/getWorkspaceLinkedDocById] Success: id=${docId}`);
    return mapRow(rows[0]);
  } catch (error) {
    console.error(
      `[${scope}/getWorkspaceLinkedDocById] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export async function createWorkspaceLinkedDoc(input: {
  workspaceId: string;
  source: LinkedDocSource;
  fileName: string;
  mimeType: string;
  description: string;
  driveFileId?: string | null;
  storagePath?: string | null;
  fileSizeBytes?: number;
  createdByUserId?: string | null;
}): Promise<
  { ok: true; record: WorkspaceLinkedDocRecord } | { ok: false; message: string }
> {
  try {
    const description = input.description.trim();
    if (!description) {
      console.info(
        `[${scope}/createWorkspaceLinkedDoc] Failed query: description required`,
      );
      return { ok: false, message: "Description is required" };
    }
    if (isFolderMimeType(input.mimeType)) {
      console.info(
        `[${scope}/createWorkspaceLinkedDoc] Failed query: folder not allowed`,
      );
      return { ok: false, message: "Directories are not allowed" };
    }
    if (input.source === "google_drive" && !input.driveFileId?.trim()) {
      return { ok: false, message: "Drive file id is required" };
    }
    if (input.source === "upload" && !input.storagePath?.trim()) {
      return { ok: false, message: "Storage path is required for uploads" };
    }

    const rows = await db
      .insert(workspaceLinkedDocs)
      .values({
        workspaceId: input.workspaceId,
        source: input.source,
        fileName: input.fileName.trim(),
        mimeType: input.mimeType.trim() || "application/octet-stream",
        description,
        driveFileId: input.driveFileId?.trim() || null,
        storagePath: input.storagePath?.trim() || null,
        fileSizeBytes: input.fileSizeBytes ?? 0,
        createdByUserId: input.createdByUserId ?? null,
      })
      .returning();

    console.info(
      `[${scope}/createWorkspaceLinkedDoc] Success: id=${rows[0].id}`,
    );
    return { ok: true, record: mapRow(rows[0]) };
  } catch (error) {
    console.error(
      `[${scope}/createWorkspaceLinkedDoc] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Failed to create linked doc" };
  }
}

export async function updateWorkspaceLinkedDoc(input: {
  workspaceId: string;
  docId: string;
  description: string;
}): Promise<
  { ok: true; record: WorkspaceLinkedDocRecord } | { ok: false; message: string }
> {
  try {
    const description = input.description.trim();
    if (!description) {
      return { ok: false, message: "Description is required" };
    }
    const rows = await db
      .update(workspaceLinkedDocs)
      .set({ description, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceLinkedDocs.workspaceId, input.workspaceId),
          eq(workspaceLinkedDocs.id, input.docId),
        ),
      )
      .returning();
    if (rows.length === 0) {
      return { ok: false, message: "Doc not found" };
    }
    console.info(
      `[${scope}/updateWorkspaceLinkedDoc] Success: id=${input.docId}`,
    );
    return { ok: true, record: mapRow(rows[0]) };
  } catch (error) {
    console.error(
      `[${scope}/updateWorkspaceLinkedDoc] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Failed to update linked doc" };
  }
}

export async function deleteWorkspaceLinkedDoc(
  workspaceId: string,
  docId: string,
): Promise<{ ok: boolean; message: string; storagePath: string | null }> {
  try {
    const rows = await db
      .delete(workspaceLinkedDocs)
      .where(
        and(
          eq(workspaceLinkedDocs.workspaceId, workspaceId),
          eq(workspaceLinkedDocs.id, docId),
        ),
      )
      .returning({
        id: workspaceLinkedDocs.id,
        storagePath: workspaceLinkedDocs.storagePath,
      });
    if (rows.length === 0) {
      console.info(
        `[${scope}/deleteWorkspaceLinkedDoc] Failed query: not found`,
      );
      return { ok: false, message: "Doc not found", storagePath: null };
    }
    console.info(`[${scope}/deleteWorkspaceLinkedDoc] Success: id=${docId}`);
    return {
      ok: true,
      message: "Deleted",
      storagePath: rows[0].storagePath,
    };
  } catch (error) {
    console.error(
      `[${scope}/deleteWorkspaceLinkedDoc] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Failed to delete", storagePath: null };
  }
}

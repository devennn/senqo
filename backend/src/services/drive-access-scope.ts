import type {
  DriveAccessMode,
  WorkspaceAppConnectionRecord,
} from "../repositories/workspace-app-connections.js";
import {
  executeGoogleDriveTool,
  findGoogleDriveItems,
  type DriveListItem,
} from "./composio.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_PARENT_WALK = 25;

export type DriveListPurpose = "browse" | "scope";

function parseParents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object" && typeof (p as { id?: unknown }).id === "string") {
        return (p as { id: string }).id;
      }
      return "";
    })
    .filter(Boolean);
}

export async function getGoogleDriveItemMeta(input: {
  workspaceId: string;
  connectedAccountId: string;
  fileId: string;
}): Promise<
  | { ok: true; id: string; name: string; mimeType: string; parents: string[] }
  | { ok: false; message: string }
> {
  const result = await executeGoogleDriveTool({
    workspaceId: input.workspaceId,
    connectedAccountId: input.connectedAccountId,
    toolSlug: "GOOGLEDRIVE_GET_FILE_METADATA",
    arguments: { file_id: input.fileId },
  });
  if (result.ok === false) {
    return {
      ok: false,
      message:
        typeof result.error === "string" ? result.error : "Metadata lookup failed",
    };
  }
  const data =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : (result as Record<string, unknown>);
  const id =
    typeof data.id === "string"
      ? data.id
      : typeof data.file_id === "string"
        ? data.file_id
        : input.fileId;
  const name = typeof data.name === "string" ? data.name : "";
  const mimeType =
    typeof data.mimeType === "string"
      ? data.mimeType
      : typeof data.mime_type === "string"
        ? data.mime_type
        : "application/octet-stream";
  const parents = parseParents(data.parents ?? data.parentIds);
  if (!name) {
    return { ok: false, message: "Drive item metadata incomplete" };
  }
  return { ok: true, id, name, mimeType, parents };
}

/** Whether a Drive file id is inside the workspace Connect jurisdiction. */
export async function isDriveFileInAccessScope(input: {
  workspaceId: string;
  connection: WorkspaceAppConnectionRecord;
  fileId: string;
}): Promise<boolean> {
  const mode = input.connection.drive_access_mode;
  if (mode === "entire_drive") return true;
  const scopeId = input.connection.drive_scope_id?.trim();
  if (!scopeId) return false;
  if (mode === "file") {
    return input.fileId === scopeId;
  }
  // folder: file itself may be the folder, or any descendant
  if (input.fileId === scopeId) return true;

  let currentId = input.fileId;
  for (let i = 0; i < MAX_PARENT_WALK; i += 1) {
    const meta = await getGoogleDriveItemMeta({
      workspaceId: input.workspaceId,
      connectedAccountId: input.connection.composio_connected_account_id,
      fileId: currentId,
    });
    if (!meta.ok) return false;
    if (meta.parents.includes(scopeId)) return true;
    if (meta.parents.length === 0) return false;
    currentId = meta.parents[0];
    if (currentId === scopeId) return true;
  }
  return false;
}

export async function listDriveItemsForConnection(input: {
  workspaceId: string;
  connection: WorkspaceAppConnectionRecord;
  purpose: DriveListPurpose;
  query?: string;
  /** When purpose=scope and picking folders, set kind=folder */
  kind?: "file" | "folder" | "any";
}): Promise<
  { ok: true; files: DriveListItem[] } | { ok: false; message: string }
> {
  const mode = input.connection.drive_access_mode;
  const kind = input.kind ?? (input.purpose === "scope" ? "any" : "file");

  if (input.purpose === "browse" && mode === "file") {
    const scopeId = input.connection.drive_scope_id?.trim();
    if (!scopeId) {
      return { ok: false, message: "Drive access is limited but no file was chosen" };
    }
    const meta = await getGoogleDriveItemMeta({
      workspaceId: input.workspaceId,
      connectedAccountId: input.connection.composio_connected_account_id,
      fileId: scopeId,
    });
    if (!meta.ok) return { ok: false, message: meta.message };
    const q = input.query?.trim().toLowerCase();
    if (q && !meta.name.toLowerCase().includes(q)) {
      return { ok: true, files: [] };
    }
    return {
      ok: true,
      files: [{ id: meta.id, name: meta.name, mimeType: meta.mimeType }],
    };
  }

  let parentFolderId: string | undefined;
  if (input.purpose === "browse" && mode === "folder") {
    parentFolderId = input.connection.drive_scope_id?.trim() || undefined;
    if (!parentFolderId) {
      return { ok: false, message: "Drive access is limited but no folder was chosen" };
    }
  }

  return findGoogleDriveItems({
    workspaceId: input.workspaceId,
    connectedAccountId: input.connection.composio_connected_account_id,
    query: input.query,
    parentFolderId,
    kind,
  });
}

export function describeDriveAccess(connection: {
  drive_access_mode: DriveAccessMode;
  drive_scope_name: string | null;
  drive_scope_id: string | null;
}): {
  accessMode: DriveAccessMode;
  scopeId: string | null;
  scopeName: string | null;
  label: string;
} {
  const accessMode = connection.drive_access_mode;
  const scopeId = connection.drive_scope_id;
  const scopeName = connection.drive_scope_name;
  if (accessMode === "entire_drive") {
    return {
      accessMode,
      scopeId,
      scopeName,
      label: "Entire Drive",
    };
  }
  if (accessMode === "folder") {
    return {
      accessMode,
      scopeId,
      scopeName,
      label: scopeName ? `Folder: ${scopeName}` : "Limited to a folder",
    };
  }
  return {
    accessMode,
    scopeId,
    scopeName,
    label: scopeName ? `File: ${scopeName}` : "Limited to one file",
  };
}

export { FOLDER_MIME };

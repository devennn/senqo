import { storageDownload } from "../lib/storage.js";
import { getWorkspaceAppConnection } from "../repositories/workspace-app-connections.js";
import {
  getAgentDocAssetById,
} from "../repositories/workspace-asset-groups.js";
import type { AgentAssetRecord } from "../types/repositories.js";
import {
  downloadGoogleDriveFileText,
  GOOGLEDRIVE_TOOLKIT,
} from "./composio.js";
import { isDriveFileInAccessScope } from "./drive-access-scope.js";

const MAX_TEXT_CHARS = 50_000;

export type ReadLinkedDocResult =
  | {
      ok: true;
      docId: string;
      fileName: string;
      description: string;
      source: string;
      text: string;
    }
  | { ok: false; error: string };

async function textFromUpload(
  doc: AgentAssetRecord,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!doc.storage_path) {
    return { ok: false, error: "Upload path missing" };
  }
  const bytes = await storageDownload("linked-docs", doc.storage_path);
  if (!bytes) {
    return { ok: false, error: "Could not download uploaded file" };
  }
  const mime = doc.mime_type.toLowerCase();
  if (
    mime.startsWith("text/") ||
    mime.includes("csv") ||
    mime.includes("json") ||
    doc.file_name.toLowerCase().endsWith(".md") ||
    doc.file_name.toLowerCase().endsWith(".csv") ||
    doc.file_name.toLowerCase().endsWith(".txt")
  ) {
    return {
      ok: true,
      text: new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, MAX_TEXT_CHARS),
    };
  }
  // Binary office/pdf: return a short notice — full extract requires dedicated parsers.
  return {
    ok: true,
    text: `[Binary file ${doc.file_name} (${doc.mime_type}), ${bytes.byteLength} bytes]. Prefer Google Drive sheets/CSV for live inventory reads.`,
  };
}

export async function readLinkedDocContent(input: {
  workspaceId: string;
  docId: string;
  allowedDocIds?: Set<string> | null;
}): Promise<ReadLinkedDocResult> {
  if (input.allowedDocIds && !input.allowedDocIds.has(input.docId)) {
    return { ok: false, error: "Doc is not attached to this agent" };
  }
  const doc = await getAgentDocAssetById(input.workspaceId, input.docId);
  if (!doc) {
    return { ok: false, error: "Doc not found" };
  }

  if (doc.source === "google_drive") {
    if (!doc.drive_file_id) {
      return { ok: false, error: "Drive file id missing" };
    }
    const connection = await getWorkspaceAppConnection(
      input.workspaceId,
      GOOGLEDRIVE_TOOLKIT,
    );
    if (!connection || connection.status !== "active") {
      return { ok: false, error: "Google Drive is not connected" };
    }
    const allowed = await isDriveFileInAccessScope({
      workspaceId: input.workspaceId,
      connection,
      fileId: doc.drive_file_id,
    });
    if (!allowed) {
      return { ok: false, error: "File is outside Connect Drive access" };
    }
    const downloaded = await downloadGoogleDriveFileText({
      workspaceId: input.workspaceId,
      connectedAccountId: connection.composio_connected_account_id,
      fileId: doc.drive_file_id,
      mimeType: doc.mime_type,
    });
    if (!downloaded.ok) {
      return { ok: false, error: downloaded.error };
    }
    return {
      ok: true,
      docId: doc.id,
      fileName: doc.file_name,
      description: doc.description,
      source: doc.source,
      text: downloaded.text.slice(0, MAX_TEXT_CHARS),
    };
  }

  const uploaded = await textFromUpload(doc);
  if (!uploaded.ok) {
    return uploaded;
  }
  return {
    ok: true,
    docId: doc.id,
    fileName: doc.file_name,
    description: doc.description,
    source: doc.source,
    text: uploaded.text,
  };
}

import { Composio } from "@composio/core";
import { env } from "../lib/env.js";
import {
  driveExportMimeType,
  extractDriveDownloadPayload,
  fetchUrlBytes,
  isGoogleSpreadsheetMime,
  workbookBytesToText,
} from "./drive-file-text.js";

const GOOGLEDRIVE_TOOLKIT = "googledrive";

/** Read-only Google Drive tool slugs allowed inside execute_code. */
export const COMPOSIO_GOOGLEDRIVE_READ_SLUGS = new Set([
  "GOOGLEDRIVE_FIND_FILE",
  "GOOGLEDRIVE_LIST_FILES",
  "GOOGLEDRIVE_GET_FILE_METADATA",
  "GOOGLEDRIVE_DOWNLOAD_FILE",
  "GOOGLEDRIVE_GET_ABOUT",
  "GOOGLEDRIVE_LIST_PERMISSIONS",
]);

export function composioUserIdForWorkspace(workspaceId: string): string {
  return `workspace_${workspaceId}`;
}

export function isComposioConfigured(): boolean {
  return Boolean(env.composioApiKey);
}

let cachedClient: Composio | null = null;

export function getComposioClient(): Composio {
  if (!env.composioApiKey) {
    throw new Error("COMPOSIO_API_KEY is not set");
  }
  if (!cachedClient) {
    cachedClient = new Composio({
      apiKey: env.composioApiKey,
      toolkitVersions: { googledrive: "latest" },
    });
  }
  return cachedClient;
}

export async function startGoogleDriveConnect(input: {
  workspaceId: string;
  callbackUrl: string;
}): Promise<{ ok: true; redirectUrl: string } | { ok: false; message: string }> {
  try {
    if (!isComposioConfigured()) {
      return { ok: false, message: "Composio is not configured" };
    }
    const composio = getComposioClient();
    const userId = composioUserIdForWorkspace(input.workspaceId);
    const session = await composio.create(userId, {
      toolkits: [GOOGLEDRIVE_TOOLKIT],
    });
    const request = await session.authorize(GOOGLEDRIVE_TOOLKIT, {
      callbackUrl: input.callbackUrl,
    });
    const redirectUrl =
      typeof request.redirectUrl === "string" ? request.redirectUrl.trim() : "";
    if (!redirectUrl) {
      return { ok: false, message: "Composio did not return a redirect URL" };
    }
    return { ok: true, redirectUrl };
  } catch (error) {
    console.error(`[Composio/startGoogleDriveConnect] Unexpected error: ${String(error)}`);
    return { ok: false, message: String(error) };
  }
}

export async function listActiveGoogleDriveAccountId(
  workspaceId: string,
): Promise<string | null> {
  try {
    if (!isComposioConfigured()) return null;
    const composio = getComposioClient();
    const userId = composioUserIdForWorkspace(workspaceId);
    const listed = await composio.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [GOOGLEDRIVE_TOOLKIT],
    });
    const items = Array.isArray(listed.items) ? listed.items : [];
    const active = items.find(
      (item) =>
        String(item.status ?? "").toUpperCase() === "ACTIVE" ||
        String(item.status ?? "").toLowerCase() === "active",
    );
    return active?.id ? String(active.id) : null;
  } catch (error) {
    console.error(
      `[Composio/listActiveGoogleDriveAccountId] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export async function executeGoogleDriveTool(input: {
  workspaceId: string;
  connectedAccountId: string;
  toolSlug: string;
  arguments: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  if (!COMPOSIO_GOOGLEDRIVE_READ_SLUGS.has(input.toolSlug)) {
    return {
      ok: false,
      error: `Tool not allowed: ${input.toolSlug}`,
    };
  }
  if (!isComposioConfigured()) {
    return { ok: false, error: "Composio is not configured" };
  }
  try {
    const composio = getComposioClient();
    const result = await composio.tools.execute(input.toolSlug, {
      userId: composioUserIdForWorkspace(input.workspaceId),
      connectedAccountId: input.connectedAccountId,
      arguments: input.arguments,
      dangerouslySkipVersionCheck: true,
    });
    if (result && typeof result === "object") {
      return result as Record<string, unknown>;
    }
    return { ok: true, data: result };
  } catch (error) {
    console.error(`[Composio/executeGoogleDriveTool] Unexpected error: ${String(error)}`);
    return { ok: false, error: String(error) };
  }
}

export type DriveListItem = {
  id: string;
  name: string;
  mimeType: string;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

export async function findGoogleDriveItems(input: {
  workspaceId: string;
  connectedAccountId: string;
  query?: string;
  parentFolderId?: string;
  /** file = non-folders only; folder = folders only; any = both */
  kind?: "file" | "folder" | "any";
}): Promise<{ ok: true; files: DriveListItem[] } | { ok: false; message: string }> {
  const q = input.query?.trim();
  const kind = input.kind ?? "file";
  const clauses = ["trashed = false"];
  if (input.parentFolderId?.trim()) {
    clauses.push(`'${input.parentFolderId.trim().replace(/'/g, "\\'")}' in parents`);
  }
  if (q) {
    clauses.push(`name contains '${q.replace(/'/g, "\\'")}'`);
  }
  if (kind === "folder") {
    clauses.push(`mimeType = '${FOLDER_MIME}'`);
  } else if (kind === "file") {
    clauses.push(`mimeType != '${FOLDER_MIME}'`);
  }

  const result = await executeGoogleDriveTool({
    workspaceId: input.workspaceId,
    connectedAccountId: input.connectedAccountId,
    toolSlug: "GOOGLEDRIVE_FIND_FILE",
    arguments: { q: clauses.join(" and ") },
  });

  if (result.ok === false) {
    return {
      ok: false,
      message: typeof result.error === "string" ? result.error : "Drive search failed",
    };
  }

  const data =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : result;
  const rawFiles = Array.isArray(data.files)
    ? data.files
    : Array.isArray((data as { data?: unknown }).data)
      ? ((data as { data: unknown[] }).data)
      : Array.isArray(result.files)
        ? result.files
        : [];

  const files = rawFiles
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      const name = typeof row.name === "string" ? row.name : "";
      const mimeType =
        typeof row.mimeType === "string"
          ? row.mimeType
          : typeof row.mime_type === "string"
            ? row.mime_type
            : "application/octet-stream";
      if (!id || !name) return null;
      if (kind === "file" && mimeType === FOLDER_MIME) return null;
      if (kind === "folder" && mimeType !== FOLDER_MIME) return null;
      return { id, name, mimeType };
    })
    .filter((f): f is DriveListItem => Boolean(f));

  return { ok: true, files };
}

/** Files only (Knowledge Docs default). */
export async function findGoogleDriveFiles(input: {
  workspaceId: string;
  connectedAccountId: string;
  query?: string;
  parentFolderId?: string;
}): Promise<{ ok: true; files: DriveListItem[] } | { ok: false; message: string }> {
  return findGoogleDriveItems({ ...input, kind: "file" });
}

export async function downloadGoogleDriveFileText(input: {
  workspaceId: string;
  connectedAccountId: string;
  fileId: string;
  mimeType?: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const exportMime = driveExportMimeType(input.mimeType);
  const args: Record<string, unknown> = {
    file_id: input.fileId,
    fileId: input.fileId,
  };
  if (exportMime) {
    args.mime_type = exportMime;
  }

  const result = await executeGoogleDriveTool({
    workspaceId: input.workspaceId,
    connectedAccountId: input.connectedAccountId,
    toolSlug: "GOOGLEDRIVE_DOWNLOAD_FILE",
    arguments: args,
  });
  if (result.ok === false || result.successful === false) {
    return {
      ok: false,
      error:
        typeof result.error === "string" && result.error.trim()
          ? result.error
          : "Download failed",
    };
  }

  const payload = extractDriveDownloadPayload(result);
  let bytes: Uint8Array | null = null;
  let text: string | null = null;

  if (payload.url) {
    const fetched = await fetchUrlBytes(payload.url);
    if (!fetched.ok) return fetched;
    bytes = fetched.bytes;
  } else if (payload.base64) {
    try {
      bytes = Uint8Array.from(Buffer.from(payload.base64, "base64"));
    } catch {
      return { ok: false, error: "Could not decode Drive file bytes" };
    }
  } else if (payload.text) {
    text = payload.text;
  }

  if (bytes) {
    // XLSX magic "PK" — Google Sheets export and native .xlsx uploads.
    const looksZip =
      bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (looksZip || isGoogleSpreadsheetMime(input.mimeType)) {
      try {
        const sheetText = workbookBytesToText(bytes);
        if (sheetText.trim()) return { ok: true, text: sheetText };
      } catch (error) {
        console.error(
          `[Composio/downloadGoogleDriveFileText] XLSX parse error: ${String(error)}`,
        );
      }
    }
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }

  if (typeof text === "string" && text.trim()) {
    return { ok: true, text };
  }

  return { ok: false, error: "Could not decode Drive file content" };
}

export { GOOGLEDRIVE_TOOLKIT };

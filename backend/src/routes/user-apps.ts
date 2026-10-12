import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../middleware/auth.js";
import type { WorkspaceVariables } from "../middleware/workspace.js";
import { env } from "../lib/env.js";
import {
  disconnectWorkspaceAppConnection,
  getWorkspaceAppConnection,
  listWorkspaceAppConnections,
  updateWorkspaceDriveAccessScope,
  upsertWorkspaceAppConnection,
} from "../repositories/workspace-app-connections.js";
import {
  createWorkspaceLinkedDoc,
  deleteWorkspaceLinkedDoc,
  getWorkspaceLinkedDocById,
  isFolderMimeType,
  listWorkspaceLinkedDocs,
  updateWorkspaceLinkedDoc,
} from "../repositories/workspace-linked-docs.js";
import {
  composioUserIdForWorkspace,
  downloadGoogleDriveFileText,
  GOOGLEDRIVE_TOOLKIT,
  isComposioConfigured,
  listActiveGoogleDriveAccountId,
  startGoogleDriveConnect,
} from "../services/composio.js";
import {
  describeDriveAccess,
  FOLDER_MIME,
  isDriveFileInAccessScope,
  listDriveItemsForConnection,
} from "../services/drive-access-scope.js";
import { googleDriveOpenUrl } from "../lib/google-drive-open-url.js";
import {
  storageCreateSignedUrl,
  storageDownload,
  storageRemove,
  storageUpload,
} from "../lib/storage.js";
import {
  extractTextPreviewForSummary,
  summarizeLinkedDocContent,
} from "../services/linked-docs-summarize.js";

type Vars = AuthVariables & WorkspaceVariables;

const app = new Hono<{ Variables: Vars }>();

const LINKED_DOC_MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_UPLOAD_EXT = new Set([
  ".pdf",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
]);

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

app.get("/", async (c) => {
  const workspaceId = c.get("workspaceId");
  const connections = await listWorkspaceAppConnections(workspaceId);
  const drive = connections.find((row) => row.toolkit === GOOGLEDRIVE_TOOLKIT);
  const access = drive
    ? describeDriveAccess(drive)
    : {
        accessMode: "entire_drive" as const,
        scopeId: null,
        scopeName: null,
        label: "Entire Drive",
      };
  return c.json({
    composioConfigured: isComposioConfigured(),
    apps: [
      {
        toolkit: GOOGLEDRIVE_TOOLKIT,
        displayName: "Google Drive",
        status:
          drive?.status === "active"
            ? "active"
            : drive
              ? "disconnected"
              : "not_connected",
        connectedAt: drive?.updated_at ?? null,
        accessMode: access.accessMode,
        scopeId: access.scopeId,
        scopeName: access.scopeName,
        accessLabel: access.label,
      },
    ],
  });
});

app.post("/googledrive/connect", async (c) => {
  const workspaceId = c.get("workspaceId");
  if (!isComposioConfigured()) {
    return c.json({ error: "composio_not_configured" }, 503);
  }
  const frontend = env.frontendUrl.replace(/\/$/, "");
  const callbackUrl = `${frontend}/${encodeURIComponent(workspaceId)}/connect?tab=apps&connected=googledrive`;
  const started = await startGoogleDriveConnect({ workspaceId, callbackUrl });
  if (!started.ok) {
    return c.json({ error: "connect_failed", message: started.message }, 502);
  }
  return c.json({ redirectUrl: started.redirectUrl });
});

app.post("/googledrive/complete", async (c) => {
  const workspaceId = c.get("workspaceId");
  if (!isComposioConfigured()) {
    return c.json({ error: "composio_not_configured" }, 503);
  }
  const accountId = await listActiveGoogleDriveAccountId(workspaceId);
  if (!accountId) {
    return c.json({ error: "connection_not_found" }, 404);
  }
  const saved = await upsertWorkspaceAppConnection({
    workspaceId,
    toolkit: GOOGLEDRIVE_TOOLKIT,
    composioUserId: composioUserIdForWorkspace(workspaceId),
    composioConnectedAccountId: accountId,
    status: "active",
  });
  if (!saved.ok) {
    return c.json({ error: "save_failed", message: saved.message }, 500);
  }
  return c.json({ ok: true, connection: saved.record });
});

app.delete("/googledrive", async (c) => {
  const workspaceId = c.get("workspaceId");
  const result = await disconnectWorkspaceAppConnection(
    workspaceId,
    GOOGLEDRIVE_TOOLKIT,
  );
  if (!result.ok) {
    return c.json({ error: "disconnect_failed", message: result.message }, 400);
  }
  return c.json({ ok: true });
});

app.patch("/googledrive/scope", async (c) => {
  const workspaceId = c.get("workspaceId");
  const body = z
    .object({
      accessMode: z.enum(["entire_drive", "folder", "file"]),
      scopeId: z.string().min(1).optional().nullable(),
      scopeName: z.string().min(1).optional().nullable(),
      scopeMimeType: z.string().optional().nullable(),
    })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "invalid_payload" }, 400);
  }
  if (body.data.accessMode === "folder") {
    const mime = body.data.scopeMimeType ?? "";
    if (mime && mime !== FOLDER_MIME) {
      return c.json({ error: "folder_required" }, 400);
    }
  }
  if (body.data.accessMode === "file") {
    const mime = body.data.scopeMimeType ?? "";
    if (mime === FOLDER_MIME) {
      return c.json({ error: "file_required" }, 400);
    }
  }
  const updated = await updateWorkspaceDriveAccessScope({
    workspaceId,
    toolkit: GOOGLEDRIVE_TOOLKIT,
    accessMode: body.data.accessMode,
    scopeId: body.data.scopeId,
    scopeName: body.data.scopeName,
    scopeMimeType: body.data.scopeMimeType,
  });
  if (!updated.ok) {
    return c.json({ error: "scope_failed", message: updated.message }, 400);
  }
  return c.json({
    ok: true,
    connection: updated.record,
    access: describeDriveAccess(updated.record),
  });
});

app.get("/googledrive/files", async (c) => {
  const workspaceId = c.get("workspaceId");
  const connection = await getWorkspaceAppConnection(
    workspaceId,
    GOOGLEDRIVE_TOOLKIT,
  );
  if (!connection || connection.status !== "active") {
    return c.json({ error: "drive_not_connected" }, 400);
  }
  const q = c.req.query("q") ?? "";
  const purposeRaw = c.req.query("purpose") ?? "browse";
  const purpose = purposeRaw === "scope" ? "scope" : "browse";
  const kindRaw = c.req.query("kind") ?? "";
  const kind =
    kindRaw === "folder" || kindRaw === "file" || kindRaw === "any"
      ? kindRaw
      : purpose === "scope"
        ? "any"
        : "file";

  const listed = await listDriveItemsForConnection({
    workspaceId,
    connection,
    purpose,
    query: q,
    kind,
  });
  if (!listed.ok) {
    return c.json({ error: "list_failed", message: listed.message }, 502);
  }
  return c.json({
    files: listed.files,
    access: describeDriveAccess(connection),
  });
});

app.get("/linked-docs", async (c) => {
  const workspaceId = c.get("workspaceId");
  const docs = await listWorkspaceLinkedDocs(workspaceId);
  const withOpenUrls = await Promise.all(
    docs.map(async (doc) => {
      if (doc.source === "google_drive" && doc.drive_file_id) {
        return {
          ...doc,
          open_url: googleDriveOpenUrl(doc.drive_file_id, doc.mime_type) || null,
        };
      }
      if (doc.source === "upload" && doc.storage_path) {
        const url = await storageCreateSignedUrl(
          "linked-docs",
          doc.storage_path,
          60 * 60,
        );
        return { ...doc, open_url: url ?? null };
      }
      return { ...doc, open_url: null };
    }),
  );
  return c.json({ docs: withOpenUrls });
});

app.post("/linked-docs", async (c) => {
  const workspaceId = c.get("workspaceId");
  const userId = c.get("userId");
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const description = String(form.get("description") ?? "").trim();
    const file = form.get("file");
    if (!description) {
      return c.json({ error: "description_required" }, 400);
    }
    if (!(file instanceof File)) {
      return c.json({ error: "file_required" }, 400);
    }
    if (file.size > LINKED_DOC_MAX_BYTES) {
      return c.json({ error: "file_too_large" }, 400);
    }
    const ext = fileExtension(file.name);
    if (!ALLOWED_UPLOAD_EXT.has(ext)) {
      return c.json({ error: "unsupported_file_type" }, 400);
    }
    const mimeType = file.type || "application/octet-stream";
    if (isFolderMimeType(mimeType)) {
      return c.json({ error: "folder_not_allowed" }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const storagePath = `${workspaceId}/${crypto.randomUUID()}${ext}`;
    const uploaded = await storageUpload("linked-docs", storagePath, bytes, mimeType);
    if (uploaded.error) {
      return c.json({ error: "upload_failed", message: uploaded.error }, 500);
    }
    const created = await createWorkspaceLinkedDoc({
      workspaceId,
      source: "upload",
      fileName: file.name,
      mimeType,
      description,
      storagePath,
      fileSizeBytes: file.size,
      createdByUserId: userId,
    });
    if (!created.ok) {
      await storageRemove("linked-docs", [storagePath]);
      return c.json({ error: "create_failed", message: created.message }, 400);
    }
    return c.json({ doc: created.record });
  }

  const body = z
    .object({
      source: z.literal("google_drive"),
      driveFileId: z.string().min(1),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      description: z.string().min(1),
    })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "invalid_payload" }, 400);
  }
  if (isFolderMimeType(body.data.mimeType)) {
    return c.json({ error: "folder_not_allowed" }, 400);
  }
  const connection = await getWorkspaceAppConnection(
    workspaceId,
    GOOGLEDRIVE_TOOLKIT,
  );
  if (!connection || connection.status !== "active") {
    return c.json({ error: "drive_not_connected" }, 400);
  }
  const allowed = await isDriveFileInAccessScope({
    workspaceId,
    connection,
    fileId: body.data.driveFileId,
  });
  if (!allowed) {
    return c.json({ error: "outside_drive_access" }, 403);
  }
  const created = await createWorkspaceLinkedDoc({
    workspaceId,
    source: "google_drive",
    fileName: body.data.fileName,
    mimeType: body.data.mimeType,
    description: body.data.description.trim(),
    driveFileId: body.data.driveFileId,
    createdByUserId: userId,
  });
  if (!created.ok) {
    return c.json({ error: "create_failed", message: created.message }, 400);
  }
  return c.json({ doc: created.record });
});

app.post("/linked-docs/summarize", async (c) => {
  const workspaceId = c.get("workspaceId");
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "file_required" }, 400);
    }
    if (file.size > LINKED_DOC_MAX_BYTES) {
      return c.json({ error: "file_too_large" }, 400);
    }
    const ext = fileExtension(file.name);
    if (!ALLOWED_UPLOAD_EXT.has(ext)) {
      return c.json({ error: "unsupported_file_type" }, 400);
    }
    const mimeType = file.type || "application/octet-stream";
    if (isFolderMimeType(mimeType)) {
      return c.json({ error: "folder_not_allowed" }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const excerpt = extractTextPreviewForSummary({
      fileName: file.name,
      mimeType,
      bytes,
    });
    const summarized = await summarizeLinkedDocContent({
      fileName: file.name,
      mimeType,
      excerpt,
    });
    if (!summarized.ok) {
      return c.json({ error: "summarize_failed", message: summarized.message }, 400);
    }
    return c.json({ description: summarized.description });
  }

  const body = z
    .object({
      source: z.literal("google_drive"),
      driveFileId: z.string().min(1),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "invalid_payload" }, 400);
  }
  if (isFolderMimeType(body.data.mimeType)) {
    return c.json({ error: "folder_not_allowed" }, 400);
  }
  const connection = await getWorkspaceAppConnection(
    workspaceId,
    GOOGLEDRIVE_TOOLKIT,
  );
  if (!connection || connection.status !== "active") {
    return c.json({ error: "drive_not_connected" }, 400);
  }
  const allowed = await isDriveFileInAccessScope({
    workspaceId,
    connection,
    fileId: body.data.driveFileId,
  });
  if (!allowed) {
    return c.json({ error: "outside_drive_access" }, 403);
  }
  const downloaded = await downloadGoogleDriveFileText({
    workspaceId,
    connectedAccountId: connection.composio_connected_account_id,
    fileId: body.data.driveFileId,
    mimeType: body.data.mimeType,
  });
  const excerpt = downloaded.ok
    ? extractTextPreviewForSummary({
        fileName: body.data.fileName,
        mimeType: body.data.mimeType,
        text: downloaded.text,
      })
    : extractTextPreviewForSummary({
        fileName: body.data.fileName,
        mimeType: body.data.mimeType,
        text: `[Drive download unavailable: ${downloaded.error}]`,
      });
  const summarized = await summarizeLinkedDocContent({
    fileName: body.data.fileName,
    mimeType: body.data.mimeType,
    excerpt,
  });
  if (!summarized.ok) {
    return c.json({ error: "summarize_failed", message: summarized.message }, 400);
  }
  return c.json({ description: summarized.description });
});

app.post("/linked-docs/:id/summarize", async (c) => {
  const workspaceId = c.get("workspaceId");
  const docId = c.req.param("id");
  const doc = await getWorkspaceLinkedDocById(workspaceId, docId);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }

  let excerpt: string;
  if (doc.source === "google_drive") {
    if (!doc.drive_file_id) {
      return c.json({ error: "drive_file_missing" }, 400);
    }
    const connection = await getWorkspaceAppConnection(
      workspaceId,
      GOOGLEDRIVE_TOOLKIT,
    );
    if (!connection || connection.status !== "active") {
      return c.json({ error: "drive_not_connected" }, 400);
    }
    const downloaded = await downloadGoogleDriveFileText({
      workspaceId,
      connectedAccountId: connection.composio_connected_account_id,
      fileId: doc.drive_file_id,
      mimeType: doc.mime_type,
    });
    excerpt = downloaded.ok
      ? extractTextPreviewForSummary({
          fileName: doc.file_name,
          mimeType: doc.mime_type,
          text: downloaded.text,
        })
      : extractTextPreviewForSummary({
          fileName: doc.file_name,
          mimeType: doc.mime_type,
          text: `[Drive download unavailable: ${downloaded.error}]`,
        });
  } else {
    if (!doc.storage_path) {
      return c.json({ error: "storage_path_missing" }, 400);
    }
    const bytes = await storageDownload("linked-docs", doc.storage_path);
    excerpt = extractTextPreviewForSummary({
      fileName: doc.file_name,
      mimeType: doc.mime_type,
      bytes,
    });
  }

  const summarized = await summarizeLinkedDocContent({
    fileName: doc.file_name,
    mimeType: doc.mime_type,
    excerpt,
  });
  if (!summarized.ok) {
    return c.json({ error: "summarize_failed", message: summarized.message }, 400);
  }
  return c.json({ description: summarized.description });
});

app.patch("/linked-docs/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const docId = c.req.param("id");
  const body = z
    .object({ description: z.string().min(1) })
    .safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "invalid_payload" }, 400);
  }
  const updated = await updateWorkspaceLinkedDoc({
    workspaceId,
    docId,
    description: body.data.description,
  });
  if (!updated.ok) {
    return c.json({ error: "update_failed", message: updated.message }, 400);
  }
  return c.json({ doc: updated.record });
});

app.delete("/linked-docs/:id", async (c) => {
  const workspaceId = c.get("workspaceId");
  const docId = c.req.param("id");
  const deleted = await deleteWorkspaceLinkedDoc(workspaceId, docId);
  if (!deleted.ok) {
    return c.json({ error: "delete_failed", message: deleted.message }, 400);
  }
  if (deleted.storagePath) {
    await storageRemove("linked-docs", [deleted.storagePath]);
  }
  return c.json({ ok: true });
});

app.get("/linked-docs/:id/preview", async (c) => {
  const workspaceId = c.get("workspaceId");
  const docId = c.req.param("id");
  const doc = await getWorkspaceLinkedDocById(workspaceId, docId);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.source === "google_drive" && doc.drive_file_id) {
    const connection = await getWorkspaceAppConnection(
      workspaceId,
      GOOGLEDRIVE_TOOLKIT,
    );
    if (!connection || connection.status !== "active") {
      return c.json({ error: "drive_not_connected" }, 400);
    }
    const downloaded = await downloadGoogleDriveFileText({
      workspaceId,
      connectedAccountId: connection.composio_connected_account_id,
      fileId: doc.drive_file_id,
      mimeType: doc.mime_type,
    });
    if (!downloaded.ok) {
      return c.json({ error: "download_failed", message: downloaded.error }, 502);
    }
    return c.json({
      text: downloaded.text.slice(0, 50_000),
      fileName: doc.file_name,
      description: doc.description,
    });
  }
  return c.json({ error: "preview_unsupported" }, 400);
});

export default app;

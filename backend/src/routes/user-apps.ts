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
  composioUserIdForWorkspace,
  GOOGLEDRIVE_TOOLKIT,
  isComposioConfigured,
  listActiveGoogleDriveAccountId,
  startGoogleDriveConnect,
} from "../services/composio.js";
import {
  describeDriveAccess,
  FOLDER_MIME,
  listDriveItemsForConnection,
} from "../services/drive-access-scope.js";

type Vars = AuthVariables & WorkspaceVariables;

const app = new Hono<{ Variables: Vars }>();

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

export default app;

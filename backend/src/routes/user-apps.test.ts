import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../lib/env.js", () => ({
  env: {
    frontendUrl: "http://localhost:5173",
    composioApiKey: "test-key",
  },
}));

vi.mock("../repositories/workspace-app-connections.js", () => ({
  listWorkspaceAppConnections: vi.fn(),
  getWorkspaceAppConnection: vi.fn(),
  upsertWorkspaceAppConnection: vi.fn(),
  disconnectWorkspaceAppConnection: vi.fn(),
  updateWorkspaceDriveAccessScope: vi.fn(),
}));

vi.mock("../services/drive-access-scope.js", () => ({
  FOLDER_MIME: "application/vnd.google-apps.folder",
  describeDriveAccess: (row: {
    drive_access_mode: string;
    drive_scope_id: string | null;
    drive_scope_name: string | null;
  }) => ({
    accessMode: row.drive_access_mode,
    scopeId: row.drive_scope_id,
    scopeName: row.drive_scope_name,
    label:
      row.drive_access_mode === "entire_drive"
        ? "Entire Drive"
        : row.drive_scope_name ?? row.drive_access_mode,
  }),
  isDriveFileInAccessScope: vi.fn().mockResolvedValue(true),
  listDriveItemsForConnection: vi.fn(),
}));

vi.mock("../repositories/workspace-linked-docs.js", () => ({
  listWorkspaceLinkedDocs: vi.fn(),
  createWorkspaceLinkedDoc: vi.fn(),
  updateWorkspaceLinkedDoc: vi.fn(),
  deleteWorkspaceLinkedDoc: vi.fn(),
  getWorkspaceLinkedDocById: vi.fn(),
  isFolderMimeType: (mime: string) =>
    mime === "application/vnd.google-apps.folder",
}));

vi.mock("../services/composio.js", () => ({
  GOOGLEDRIVE_TOOLKIT: "googledrive",
  isComposioConfigured: vi.fn(() => true),
  composioUserIdForWorkspace: (id: string) => `workspace_${id}`,
  startGoogleDriveConnect: vi.fn(),
  listActiveGoogleDriveAccountId: vi.fn(),
  findGoogleDriveFiles: vi.fn(),
  downloadGoogleDriveFileText: vi.fn(),
}));

vi.mock("../lib/storage.js", () => ({
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  storageDownload: vi.fn(),
}));

vi.mock("../services/linked-docs-summarize.js", () => ({
  extractTextPreviewForSummary: vi.fn(({ text, fileName }: { text?: string; fileName: string }) =>
    text ?? `preview:${fileName}`,
  ),
  summarizeLinkedDocContent: vi.fn(),
}));

import userAppsRoute from "./user-apps.js";
import {
  disconnectWorkspaceAppConnection,
  getWorkspaceAppConnection,
  listWorkspaceAppConnections,
  upsertWorkspaceAppConnection,
} from "../repositories/workspace-app-connections.js";
import {
  createWorkspaceLinkedDoc,
  getWorkspaceLinkedDocById,
} from "../repositories/workspace-linked-docs.js";
import {
  downloadGoogleDriveFileText,
  listActiveGoogleDriveAccountId,
  startGoogleDriveConnect,
} from "../services/composio.js";
import { summarizeLinkedDocContent } from "../services/linked-docs-summarize.js";

function appWithAuth() {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("userId" as never, "user-1" as never);
    c.set("workspaceId" as never, "ws-1" as never);
    await next();
  });
  app.route("/apps", userAppsRoute);
  return app;
}

describe("GET /apps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Lists Drive status for Connect → Apps even when never connected.
  it("returns googledrive not_connected when no row", async () => {
    vi.mocked(listWorkspaceAppConnections).mockResolvedValueOnce([]);
    const res = await appWithAuth().request("/apps");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apps).toEqual([
      expect.objectContaining({
        toolkit: "googledrive",
        status: "not_connected",
      }),
    ]);
  });
});

describe("POST /apps/googledrive/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // After OAuth redirect, persist the Composio connected account id.
  it("upserts active connection when Composio account exists", async () => {
    vi.mocked(listActiveGoogleDriveAccountId).mockResolvedValueOnce("ca-99");
    vi.mocked(upsertWorkspaceAppConnection).mockResolvedValueOnce({
      ok: true,
      record: {
        id: "row-1",
        workspace_id: "ws-1",
        toolkit: "googledrive",
        composio_user_id: "workspace_ws-1",
        composio_connected_account_id: "ca-99",
        status: "active",
        drive_access_mode: "entire_drive",
        drive_scope_id: null,
        drive_scope_name: null,
        drive_scope_mime_type: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    });

    const res = await appWithAuth().request("/apps/googledrive/complete", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(upsertWorkspaceAppConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        composioConnectedAccountId: "ca-99",
        status: "active",
      }),
    );
  });
});

describe("DELETE /apps/googledrive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Disconnect updates local status so Apps UI shows Disconnected.
  it("disconnects and returns ok", async () => {
    vi.mocked(disconnectWorkspaceAppConnection).mockResolvedValueOnce({
      ok: true,
      message: "Disconnected",
    });
    const res = await appWithAuth().request("/apps/googledrive", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /apps/googledrive/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Connect returns Composio redirect and includes workspace in callback URL.
  it("returns redirectUrl from Composio", async () => {
    vi.mocked(startGoogleDriveConnect).mockResolvedValueOnce({
      ok: true,
      redirectUrl: "https://composio.dev/oauth",
    });
    const res = await appWithAuth().request("/apps/googledrive/connect", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      redirectUrl: "https://composio.dev/oauth",
    });
    expect(startGoogleDriveConnect).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      callbackUrl:
        "http://localhost:5173/ws-1/connect?tab=apps&connected=googledrive",
    });
  });
});

describe("POST /apps/linked-docs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Drive create requires description and rejects folder mime at the route.
  it("rejects folder mime for google_drive source", async () => {
    const res = await appWithAuth().request("/apps/linked-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "google_drive",
        driveFileId: "folder-1",
        fileName: "Folder",
        mimeType: "application/vnd.google-apps.folder",
        description: "A folder",
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "folder_not_allowed" });
    expect(createWorkspaceLinkedDoc).not.toHaveBeenCalled();
  });

  // Empty description fails validation before create.
  it("rejects google_drive payload without description", async () => {
    const res = await appWithAuth().request("/apps/linked-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "google_drive",
        driveFileId: "file-1",
        fileName: "inv.csv",
        mimeType: "text/csv",
        description: "",
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_payload" });
  });
});

describe("POST /apps/linked-docs/summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Drive summarize downloads content then returns an agent-facing description.
  it("returns AI description for a Drive file", async () => {
    vi.mocked(getWorkspaceAppConnection).mockResolvedValueOnce({
      id: "c1",
      workspace_id: "ws-1",
      toolkit: "googledrive",
      composio_user_id: "workspace_ws-1",
      composio_connected_account_id: "ca-1",
      status: "active",
      drive_access_mode: "entire_drive",
      drive_scope_id: null,
      drive_scope_name: null,
      drive_scope_mime_type: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(downloadGoogleDriveFileText).mockResolvedValueOnce({
      ok: true,
      text: "sku,qty\nA,10",
    });
    vi.mocked(summarizeLinkedDocContent).mockResolvedValueOnce({
      ok: true,
      description: "Inventory CSV — answer stock levels via readLinkedDoc.",
    });

    const res = await appWithAuth().request("/apps/linked-docs/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "google_drive",
        driveFileId: "drive-1",
        fileName: "stock.csv",
        mimeType: "text/csv",
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      description: "Inventory CSV — answer stock levels via readLinkedDoc.",
    });
  });
});

describe("POST /apps/linked-docs/:id/summarize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Existing Drive docs can regenerate description from live content.
  it("summarizes an existing google_drive linked doc", async () => {
    vi.mocked(getWorkspaceLinkedDocById).mockResolvedValueOnce({
      id: "doc-1",
      workspace_id: "ws-1",
      source: "google_drive",
      file_name: "stock.csv",
      mime_type: "text/csv",
      description: "old",
      drive_file_id: "drive-1",
      storage_path: null,
      file_size_bytes: 0,
      created_by_user_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(getWorkspaceAppConnection).mockResolvedValueOnce({
      id: "c1",
      workspace_id: "ws-1",
      toolkit: "googledrive",
      composio_user_id: "workspace_ws-1",
      composio_connected_account_id: "ca-1",
      status: "active",
      drive_access_mode: "entire_drive",
      drive_scope_id: null,
      drive_scope_name: null,
      drive_scope_mime_type: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(downloadGoogleDriveFileText).mockResolvedValueOnce({
      ok: true,
      text: "sku,qty\nA,10",
    });
    vi.mocked(summarizeLinkedDocContent).mockResolvedValueOnce({
      ok: true,
      description: "Live stock sheet — use for inventory Q&A.",
    });

    const res = await appWithAuth().request("/apps/linked-docs/doc-1/summarize", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      description: "Live stock sheet — use for inventory Q&A.",
    });
  });
});

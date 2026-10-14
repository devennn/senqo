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

vi.mock("../services/composio.js", () => ({
  GOOGLEDRIVE_TOOLKIT: "googledrive",
  isComposioConfigured: vi.fn(() => true),
  composioUserIdForWorkspace: (id: string) => `workspace_${id}`,
  startGoogleDriveConnect: vi.fn(),
  listActiveGoogleDriveAccountId: vi.fn(),
  findGoogleDriveFiles: vi.fn(),
  downloadGoogleDriveFileText: vi.fn(),
}));

import userAppsRoute from "./user-apps.js";
import {
  disconnectWorkspaceAppConnection,
  listWorkspaceAppConnections,
  upsertWorkspaceAppConnection,
} from "../repositories/workspace-app-connections.js";
import {
  listActiveGoogleDriveAccountId,
  startGoogleDriveConnect,
} from "../services/composio.js";

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

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
const mockFindItems = vi.fn();

vi.mock("./composio.js", () => ({
  executeGoogleDriveTool: (...args: unknown[]) => mockExecute(...args),
  findGoogleDriveItems: (...args: unknown[]) => mockFindItems(...args),
}));

import {
  describeDriveAccess,
  isDriveFileInAccessScope,
  listDriveItemsForConnection,
} from "./drive-access-scope.js";

const baseConnection = {
  id: "c1",
  workspace_id: "ws-1",
  toolkit: "googledrive",
  composio_user_id: "workspace_ws-1",
  composio_connected_account_id: "ca-1",
  status: "active",
  drive_access_mode: "entire_drive" as const,
  drive_scope_id: null as string | null,
  drive_scope_name: null as string | null,
  drive_scope_mime_type: null as string | null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("isDriveFileInAccessScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Entire Drive allows any file id without metadata calls.
  it("allows any file when mode is entire_drive", async () => {
    const ok = await isDriveFileInAccessScope({
      workspaceId: "ws-1",
      connection: baseConnection,
      fileId: "any-file",
    });
    expect(ok).toBe(true);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  // File mode only allows the exact scoped id.
  it("allows only the scoped file id in file mode", async () => {
    const connection = {
      ...baseConnection,
      drive_access_mode: "file" as const,
      drive_scope_id: "file-1",
    };
    expect(
      await isDriveFileInAccessScope({
        workspaceId: "ws-1",
        connection,
        fileId: "file-1",
      }),
    ).toBe(true);
    expect(
      await isDriveFileInAccessScope({
        workspaceId: "ws-1",
        connection,
        fileId: "other",
      }),
    ).toBe(false);
  });

  // Folder mode walks parents until the scoped folder is found.
  it("allows descendants when parent chain includes scoped folder", async () => {
    mockExecute.mockResolvedValueOnce({
      ok: true,
      data: { id: "child", name: "a.csv", mimeType: "text/csv", parents: ["folder-1"] },
    });
    const ok = await isDriveFileInAccessScope({
      workspaceId: "ws-1",
      connection: {
        ...baseConnection,
        drive_access_mode: "folder",
        drive_scope_id: "folder-1",
      },
      fileId: "child",
    });
    expect(ok).toBe(true);
  });
});

describe("listDriveItemsForConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Browse under folder mode searches only inside the scoped parent.
  it("passes parentFolderId when browsing with folder scope", async () => {
    mockFindItems.mockResolvedValueOnce({ ok: true, files: [] });
    await listDriveItemsForConnection({
      workspaceId: "ws-1",
      connection: {
        ...baseConnection,
        drive_access_mode: "folder",
        drive_scope_id: "folder-1",
        drive_scope_name: "Ops",
      },
      purpose: "browse",
      kind: "file",
    });
    expect(mockFindItems).toHaveBeenCalledWith(
      expect.objectContaining({
        parentFolderId: "folder-1",
        kind: "file",
      }),
    );
  });

  // Scope purpose lists without jurisdiction parent so Connect can pick a root.
  it("lists without parent when purpose is scope", async () => {
    mockFindItems.mockResolvedValueOnce({ ok: true, files: [] });
    await listDriveItemsForConnection({
      workspaceId: "ws-1",
      connection: {
        ...baseConnection,
        drive_access_mode: "folder",
        drive_scope_id: "folder-1",
      },
      purpose: "scope",
      kind: "folder",
    });
    expect(mockFindItems).toHaveBeenCalledWith(
      expect.objectContaining({
        parentFolderId: undefined,
        kind: "folder",
      }),
    );
  });
});

describe("describeDriveAccess", () => {
  // UI label for folder scope includes the folder name.
  it("labels folder scope with name", () => {
    expect(
      describeDriveAccess({
        drive_access_mode: "folder",
        drive_scope_id: "f1",
        drive_scope_name: "Inventory",
      }).label,
    ).toBe("Folder: Inventory");
  });
});

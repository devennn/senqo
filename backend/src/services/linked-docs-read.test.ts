import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetDoc = vi.fn();
const mockGetConnection = vi.fn();
const mockDownloadDrive = vi.fn();
const mockStorageDownload = vi.fn();

vi.mock("../repositories/workspace-linked-docs.js", () => ({
  getWorkspaceLinkedDocById: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock("../repositories/workspace-app-connections.js", () => ({
  getWorkspaceAppConnection: (...args: unknown[]) => mockGetConnection(...args),
}));

vi.mock("./composio.js", () => ({
  GOOGLEDRIVE_TOOLKIT: "googledrive",
  downloadGoogleDriveFileText: (...args: unknown[]) => mockDownloadDrive(...args),
}));

vi.mock("./drive-access-scope.js", () => ({
  isDriveFileInAccessScope: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/storage.js", () => ({
  storageDownload: (...args: unknown[]) => mockStorageDownload(...args),
}));

describe("readLinkedDocContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Agent may only read docs attached on Profile → Capability.
  it("rejects doc ids outside the allowed set", async () => {
    const { readLinkedDocContent } = await import("./linked-docs-read.js");
    const result = await readLinkedDocContent({
      workspaceId: "ws-1",
      docId: "doc-other",
      allowedDocIds: new Set(["doc-1"]),
    });
    expect(result).toEqual({
      ok: false,
      error: "Doc is not attached to this agent",
    });
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  // Drive-backed docs pull live content through Composio when Drive is connected.
  it("reads google_drive docs via Composio download", async () => {
    mockGetDoc.mockResolvedValueOnce({
      id: "doc-1",
      workspace_id: "ws-1",
      source: "google_drive",
      file_name: "stock.csv",
      mime_type: "text/csv",
      description: "Inventory",
      drive_file_id: "drive-1",
      storage_path: null,
      file_size_bytes: 0,
      created_by_user_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    mockGetConnection.mockResolvedValueOnce({
      status: "active",
      composio_connected_account_id: "ca-1",
      drive_access_mode: "entire_drive",
      drive_scope_id: null,
      drive_scope_name: null,
      drive_scope_mime_type: null,
    });
    mockDownloadDrive.mockResolvedValueOnce({
      ok: true,
      text: "sku,qty\nA,10",
    });

    const { readLinkedDocContent } = await import("./linked-docs-read.js");
    const result = await readLinkedDocContent({
      workspaceId: "ws-1",
      docId: "doc-1",
      allowedDocIds: new Set(["doc-1"]),
    });

    expect(result).toEqual({
      ok: true,
      docId: "doc-1",
      fileName: "stock.csv",
      description: "Inventory",
      source: "google_drive",
      text: "sku,qty\nA,10",
    });
    expect(mockDownloadDrive).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      connectedAccountId: "ca-1",
      fileId: "drive-1",
      mimeType: "text/csv",
    });
  });

  // Uploaded text/csv docs are read from S3 without Composio.
  it("reads upload docs from storage as utf-8 text", async () => {
    mockGetDoc.mockResolvedValueOnce({
      id: "doc-2",
      workspace_id: "ws-1",
      source: "upload",
      file_name: "notes.txt",
      mime_type: "text/plain",
      description: "Notes",
      drive_file_id: null,
      storage_path: "ws-1/notes.txt",
      file_size_bytes: 5,
      created_by_user_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    mockStorageDownload.mockResolvedValueOnce(
      new TextEncoder().encode("hello"),
    );

    const { readLinkedDocContent } = await import("./linked-docs-read.js");
    const result = await readLinkedDocContent({
      workspaceId: "ws-1",
      docId: "doc-2",
    });

    expect(result).toEqual({
      ok: true,
      docId: "doc-2",
      fileName: "notes.txt",
      description: "Notes",
      source: "upload",
      text: "hello",
    });
  });
});

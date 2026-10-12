import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("../db/index.js", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

describe("createWorkspaceLinkedDoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Description is required so Knowledge Docs always tell the agent what the file is for.
  it("rejects empty description before insert", async () => {
    const { createWorkspaceLinkedDoc } = await import("./workspace-linked-docs.js");
    const result = await createWorkspaceLinkedDoc({
      workspaceId: "ws-1",
      source: "upload",
      fileName: "inv.csv",
      mimeType: "text/csv",
      description: "   ",
      storagePath: "ws-1/a.csv",
    });
    expect(result).toEqual({ ok: false, message: "Description is required" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // Folders are not linkable docs — Drive pickers must not persist directory mime types.
  it("rejects Google Drive folder mime types", async () => {
    const { createWorkspaceLinkedDoc } = await import("./workspace-linked-docs.js");
    const result = await createWorkspaceLinkedDoc({
      workspaceId: "ws-1",
      source: "google_drive",
      fileName: "My folder",
      mimeType: "application/vnd.google-apps.folder",
      description: "Inventory folder",
      driveFileId: "folder-1",
    });
    expect(result).toEqual({ ok: false, message: "Directories are not allowed" });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  // Happy path persists a Drive file when description and drive id are present.
  it("inserts a google_drive linked doc when payload is valid", async () => {
    const now = new Date("2026-10-08T00:00:00.000Z");
    mockReturning.mockResolvedValueOnce([
      {
        id: "doc-1",
        workspaceId: "ws-1",
        source: "google_drive",
        fileName: "stock.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        description: "Kitchen inventory",
        driveFileId: "drive-1",
        storagePath: null,
        fileSizeBytes: 0,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const { createWorkspaceLinkedDoc } = await import("./workspace-linked-docs.js");
    const result = await createWorkspaceLinkedDoc({
      workspaceId: "ws-1",
      source: "google_drive",
      fileName: "stock.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      description: "Kitchen inventory",
      driveFileId: "drive-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.id).toBe("doc-1");
      expect(result.record.description).toBe("Kitchen inventory");
      expect(result.record.drive_file_id).toBe("drive-1");
    }
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("isFolderMimeType", () => {
  // Shared helper used by routes and repos to reject directories.
  it("detects Google Drive folder mime", async () => {
    const { isFolderMimeType } = await import("./workspace-linked-docs.js");
    expect(isFolderMimeType("application/vnd.google-apps.folder")).toBe(true);
    expect(isFolderMimeType("text/csv")).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockReleaseStorage = vi.fn();
const mockReserveStorage = vi.fn();

const mockDb = {
  select: vi.fn().mockReturnValue({ from: mockFrom }),
  insert: vi.fn().mockReturnValue({ values: mockValues }),
  update: vi.fn().mockReturnValue({ set: mockSet }),
  delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

vi.mock("../lib/storage.js", () => ({
  storageUpload: (...args: unknown[]) => mockStorageUpload(...args),
  storageRemove: (...args: unknown[]) => mockStorageRemove(...args),
  storageDownload: vi.fn(),
  storageCreateSignedUrl: vi.fn().mockResolvedValue(null),
}));

vi.mock("./workspace-storage.js", () => ({
  releaseWorkspaceStorage: (...args: unknown[]) => mockReleaseStorage(...args),
  reserveWorkspaceStorage: (...args: unknown[]) => mockReserveStorage(...args),
}));

const GROUP_ID = "group-1";

const storedDocAsset = {
  id: "asset-1",
  workspaceId: "ws-1",
  groupId: GROUP_ID,
  kind: "doc",
  source: "google_drive",
  fileName: "stock.csv",
  storagePath: null,
  driveFileId: "drive-1",
  mimeType: "text/csv",
  description: "Inventory",
  fileSizeBytes: 0,
  sortOrder: 3,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("createAgentDriveDocInGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  // Live Drive docs are stored as kind=doc rows with the Drive id and no storage path.
  it("stores a doc asset with google_drive source when under the group cap", async () => {
    mockWhere.mockResolvedValueOnce([{ count: 3 }]);
    mockReturning.mockResolvedValueOnce([storedDocAsset]);

    const { createAgentDriveDocInGroup } = await import("./workspace-asset-groups.js");
    const result = await createAgentDriveDocInGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      driveFileId: "drive-1",
      fileName: "stock.csv",
      mimeType: "text/csv",
      description: "Inventory",
    });

    expect(result.ok).toBe(true);
    expect(result.asset).toMatchObject({
      id: "asset-1",
      kind: "doc",
      source: "google_drive",
      storage_path: null,
      drive_file_id: "drive-1",
      sort_order: 3,
    });
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: GROUP_ID,
        kind: "doc",
        source: "google_drive",
        storagePath: null,
        driveFileId: "drive-1",
      }),
    );
  });

  // Directories can never be attached as live docs.
  it("rejects folder mime before touching the database", async () => {
    const { createAgentDriveDocInGroup } = await import("./workspace-asset-groups.js");
    const result = await createAgentDriveDocInGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      driveFileId: "folder-1",
      fileName: "Folder",
      mimeType: "application/vnd.google-apps.folder",
      description: "A folder",
    });

    expect(result).toEqual({ ok: false, message: "Directories are not allowed." });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  // Group cap counts docs and sendable files together.
  it("refuses to add a doc when the group is full", async () => {
    mockWhere.mockResolvedValueOnce([{ count: 40 }]);

    const { createAgentDriveDocInGroup } = await import("./workspace-asset-groups.js");
    const result = await createAgentDriveDocInGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      driveFileId: "drive-1",
      fileName: "stock.csv",
      mimeType: "text/csv",
      description: "Inventory",
    });

    expect(result).toEqual({ ok: false, message: "At most 40 items per group." });
    expect(mockValues).not.toHaveBeenCalled();
  });
});

describe("createAgentAssetInGroup doc uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockStorageUpload.mockResolvedValue({ error: null });
  });

  // Uploaded live docs keep the doc bucket so readLinkedDoc can keep serving them.
  it("stores an uploaded doc in the linked-docs bucket without consuming asset quota", async () => {
    mockWhere.mockResolvedValueOnce([{ count: 0 }]);
    mockReturning.mockResolvedValueOnce([
      { ...storedDocAsset, source: "upload", driveFileId: null, storagePath: "ws-1/upload.csv" },
    ]);

    const { createAgentAssetInGroup } = await import("./workspace-asset-groups.js");
    const result = await createAgentAssetInGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      kind: "doc",
      fileName: "notes.csv",
      mimeType: "text/csv",
      description: "Notes",
      data: new TextEncoder().encode("sku,qty").buffer,
    });

    expect(result.ok).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledWith(
      "linked-docs",
      expect.stringMatching(/^ws-1\/.+\.csv$/),
      expect.anything(),
      "text/csv",
    );
    expect(mockReserveStorage).not.toHaveBeenCalled();
    expect(mockReleaseStorage).not.toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "doc", source: "upload" }),
    );
  });

  // Live docs only accept the document extensions the reader can extract text from.
  it("rejects a doc upload with an unsupported extension", async () => {
    const { createAgentAssetInGroup } = await import("./workspace-asset-groups.js");
    const result = await createAgentAssetInGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      kind: "doc",
      fileName: "installer.exe",
      mimeType: "application/octet-stream",
      description: "Nope",
      data: new TextEncoder().encode("binary").buffer,
    });

    expect(result).toEqual({ ok: false, message: "Unsupported file type." });
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  // Descriptions ground the agent prompt, so doc uploads require one.
  it("rejects a doc upload without a description", async () => {
    const { createAgentAssetInGroup } = await import("./workspace-asset-groups.js");
    const result = await createAgentAssetInGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      kind: "doc",
      fileName: "notes.csv",
      mimeType: "text/csv",
      description: "   ",
      data: new TextEncoder().encode("sku,qty").buffer,
    });

    expect(result).toEqual({ ok: false, message: "Description is required." });
  });
});

describe("deleteAgentAssetFromGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  // Doc uploads live in the doc bucket and never counted against asset quota, so no release.
  it("removes an uploaded doc from the doc bucket without releasing asset storage", async () => {
    mockLimit.mockResolvedValueOnce([
      { kind: "doc", source: "upload", storagePath: "ws-1/notes.csv", fileSizeBytes: 120 },
    ]);

    const { deleteAgentAssetFromGroup } = await import("./workspace-asset-groups.js");
    const result = await deleteAgentAssetFromGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      assetId: "asset-1",
    });

    expect(result).toEqual({ ok: true, message: "Asset deleted" });
    expect(mockStorageRemove).toHaveBeenCalledWith("linked-docs", ["ws-1/notes.csv"]);
    expect(mockReleaseStorage).not.toHaveBeenCalled();
  });

  // Sendable files free their quota again when removed.
  it("releases asset storage when deleting an uploaded file", async () => {
    mockLimit.mockResolvedValueOnce([
      { kind: "file", source: "upload", storagePath: "ws-1/g/a/big.pdf", fileSizeBytes: 2048 },
    ]);

    const { deleteAgentAssetFromGroup } = await import("./workspace-asset-groups.js");
    const result = await deleteAgentAssetFromGroup({
      workspaceId: "ws-1",
      groupId: GROUP_ID,
      assetId: "asset-2",
    });

    expect(result).toEqual({ ok: true, message: "Asset deleted" });
    expect(mockStorageRemove).toHaveBeenCalledWith("agent-assets", ["ws-1/g/a/big.pdf"]);
    expect(mockReleaseStorage).toHaveBeenCalledWith("ws-1", "asset", 2048);
  });
});

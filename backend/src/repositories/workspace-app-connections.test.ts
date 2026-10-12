import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockInsertReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockInsertReturning }));

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
  update: vi.fn(() => ({ set: mockSet })),
  insert: vi.fn(() => ({ values: mockValues })),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

describe("upsertWorkspaceAppConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockReturning });
    mockValues.mockReturnValue({ returning: mockInsertReturning });
  });

  // First connect creates a row so Connect → Apps can show active Drive status.
  it("inserts when no connection exists for toolkit", async () => {
    mockLimit.mockResolvedValueOnce([]);
    const now = new Date("2026-10-08T00:00:00.000Z");
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: "conn-1",
        workspaceId: "ws-1",
        toolkit: "googledrive",
        composioUserId: "workspace_ws-1",
        composioConnectedAccountId: "ca-1",
        status: "active",
        driveAccessMode: "entire_drive",
        driveScopeId: null,
        driveScopeName: null,
        driveScopeMimeType: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const { upsertWorkspaceAppConnection } = await import(
      "./workspace-app-connections.js"
    );
    const result = await upsertWorkspaceAppConnection({
      workspaceId: "ws-1",
      toolkit: "googledrive",
      composioUserId: "workspace_ws-1",
      composioConnectedAccountId: "ca-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.composio_connected_account_id).toBe("ca-1");
      expect(result.record.status).toBe("active");
    }
    expect(mockDb.insert).toHaveBeenCalled();
  });

  // Re-connect updates the stored Composio account id without duplicating rows.
  it("updates existing connection for the same toolkit", async () => {
    const now = new Date("2026-10-08T00:00:00.000Z");
    mockLimit.mockResolvedValueOnce([
      {
        id: "conn-1",
        workspaceId: "ws-1",
        toolkit: "googledrive",
        composioUserId: "workspace_ws-1",
        composioConnectedAccountId: "ca-old",
        status: "disconnected",
        driveAccessMode: "entire_drive",
        driveScopeId: null,
        driveScopeName: null,
        driveScopeMimeType: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockReturning.mockResolvedValueOnce([
      {
        id: "conn-1",
        workspaceId: "ws-1",
        toolkit: "googledrive",
        composioUserId: "workspace_ws-1",
        composioConnectedAccountId: "ca-new",
        status: "active",
        driveAccessMode: "entire_drive",
        driveScopeId: null,
        driveScopeName: null,
        driveScopeMimeType: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const { upsertWorkspaceAppConnection } = await import(
      "./workspace-app-connections.js"
    );
    const result = await upsertWorkspaceAppConnection({
      workspaceId: "ws-1",
      toolkit: "googledrive",
      composioUserId: "workspace_ws-1",
      composioConnectedAccountId: "ca-new",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.composio_connected_account_id).toBe("ca-new");
    }
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("disconnectWorkspaceAppConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockReturning });
  });

  // Disconnect marks status disconnected so Apps UI and Drive file picks stop working.
  it("sets status to disconnected when a row exists", async () => {
    mockReturning.mockResolvedValueOnce([{ id: "conn-1" }]);
    const { disconnectWorkspaceAppConnection } = await import(
      "./workspace-app-connections.js"
    );
    const result = await disconnectWorkspaceAppConnection("ws-1", "googledrive");
    expect(result).toEqual({ ok: true, message: "Disconnected" });
  });

  // Missing connection returns failure so DELETE /apps/googledrive can 400.
  it("returns not found when no row matches", async () => {
    mockReturning.mockResolvedValueOnce([]);
    const { disconnectWorkspaceAppConnection } = await import(
      "./workspace-app-connections.js"
    );
    const result = await disconnectWorkspaceAppConnection("ws-1", "googledrive");
    expect(result).toEqual({ ok: false, message: "Connection not found" });
  });
});

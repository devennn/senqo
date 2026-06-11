import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStorageUpload = vi.fn();
vi.mock("../lib/storage.js", () => ({
  storageUpload: mockStorageUpload,
  storageDownload: vi.fn(),
  storageRemove: vi.fn(),
}));

const mockOrderBy = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

const mockDb = {
  select: vi.fn().mockReturnValue({ from: mockFrom }),
  insert: vi.fn().mockReturnValue({ values: mockValues }),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const { createWorkspaceSkill, listActiveWorkspaceSkills, listWorkspaceSkills } =
  await vi.importActual("../repositories/skills.js") as typeof import("../repositories/skills.js");

beforeEach(() => { vi.clearAllMocks(); });

describe("createWorkspaceSkill", () => {
  // Valid skill data with content is provided → content is uploaded to storage, row is inserted, and ok:true with skillId is returned, needed to verify the full create flow.
  it("inserts with storage-backed content key and returns ok true", async () => {
    mockStorageUpload.mockResolvedValue({ error: null });
    mockReturning.mockResolvedValue([{ id: "skill-1" }]);
    const result = await createWorkspaceSkill({
      workspaceId: "ws-1",
      displayName: "My Skill",
      description: "Does stuff",
      content: "# Skill content",
    });
    expect(result.ok).toBe(true);
    expect(result.skillId).toBe("skill-1");
  });

  // displayName is empty → ok:false with validation message, needed to catch invalid input before hitting the database.
  it("fails with invalid skill name (empty displayName)", async () => {
    const result = await createWorkspaceSkill({
      workspaceId: "ws-1",
      displayName: "",
      description: "",
      content: "",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid skill name");
  });
});

describe("listActiveWorkspaceSkills", () => {
  // Only active skills exist for the workspace → they are returned filtered by isActive:true, needed to ensure the caller receives only usable skills.
  it("returns only active skills filtered by isActive true", async () => {
    const rows = [{ id: "s1", workspaceId: "ws-1", skillKey: "my_skill", displayName: "My Skill", description: "", storagePath: "", isActive: true, createdAt: new Date(), updatedAt: new Date() }];
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue({ orderBy: mockOrderBy }) });
    mockOrderBy.mockResolvedValue(rows);
    const result = await listActiveWorkspaceSkills("ws-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });
});

describe("listWorkspaceSkills", () => {
  // Both active and inactive skills exist → all are returned without filtering, needed to confirm the admin listing includes deactivated skills too.
  it("returns all skills with no isActive filter", async () => {
    const rows = [
      { id: "s1", workspaceId: "ws-1", skillKey: "active", displayName: "Active", description: "", storagePath: "", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", workspaceId: "ws-1", skillKey: "inactive", displayName: "Inactive", description: "", storagePath: "", isActive: false, createdAt: new Date(), updatedAt: new Date() },
    ];
    mockFrom.mockReturnValue({ where: mockWhere.mockReturnValue({ orderBy: mockOrderBy }) });
    mockOrderBy.mockResolvedValue(rows);
    const result = await listWorkspaceSkills("ws-1");
    expect(result).toHaveLength(2);
  });
});

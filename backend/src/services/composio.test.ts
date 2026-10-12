import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/env.js", () => ({
  env: { composioApiKey: "test-key" },
}));

const mockExecute = vi.fn();

vi.mock("@composio/core", () => ({
  Composio: class {
    tools = { execute: (...args: unknown[]) => mockExecute(...args) };
    create = vi.fn();
    connectedAccounts = { list: vi.fn() };
  },
}));

describe("executeGoogleDriveTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mutation slugs must never run from execute_code — deny before calling Composio.
  it("denies non-allowlisted tool slugs", async () => {
    const { executeGoogleDriveTool } = await import("./composio.js");
    const result = await executeGoogleDriveTool({
      workspaceId: "ws-1",
      connectedAccountId: "ca-1",
      toolSlug: "GOOGLEDRIVE_DELETE_FILE",
      arguments: { file_id: "x" },
    });
    expect(result).toEqual({
      ok: false,
      error: "Tool not allowed: GOOGLEDRIVE_DELETE_FILE",
    });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  // Allowlisted read tools forward to Composio tools.execute.
  it("executes allowlisted GOOGLEDRIVE_FIND_FILE", async () => {
    mockExecute.mockResolvedValueOnce({ ok: true, data: { files: [] } });
    const { executeGoogleDriveTool } = await import("./composio.js");
    const result = await executeGoogleDriveTool({
      workspaceId: "ws-1",
      connectedAccountId: "ca-1",
      toolSlug: "GOOGLEDRIVE_FIND_FILE",
      arguments: { q: "trashed = false" },
    });
    expect(result).toEqual({ ok: true, data: { files: [] } });
    expect(mockExecute).toHaveBeenCalledWith(
      "GOOGLEDRIVE_FIND_FILE",
      expect.objectContaining({
        userId: "workspace_ws-1",
        connectedAccountId: "ca-1",
      }),
    );
  });
});

describe("composioUserIdForWorkspace", () => {
  // Entity id is stable so one Drive account maps to one workspace.
  it("prefixes workspace id", async () => {
    const { composioUserIdForWorkspace } = await import("./composio.js");
    expect(composioUserIdForWorkspace("abc")).toBe("workspace_abc");
  });
});

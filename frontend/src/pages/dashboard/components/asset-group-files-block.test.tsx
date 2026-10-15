import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { api } from "@/lib/api";
import { AssetGroupFilesBlock } from "./asset-group-files-block";
import type { AgentAssetRecord } from "@/types/repositories";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function makeAsset(id: string, fileName: string): AgentAssetRecord {
  return {
    id,
    workspace_id: "ws-1",
    group_id: "g1",
    kind: "doc",
    source: "google_drive",
    file_name: fileName,
    storage_path: null,
    drive_file_id: `drive-${id}`,
    mime_type: "text/csv",
    description: "old",
    file_size_bytes: 0,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const reloadGroup = vi.fn();
const onWorkspaceStale = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ composioConfigured: false, apps: [] } as never);
  reloadGroup.mockResolvedValue(undefined);
  onWorkspaceStale.mockResolvedValue(undefined);
});

function renderBlock(assets: AgentAssetRecord[]) {
  render(
    <AssetGroupFilesBlock
      groupId="g1"
      assets={assets}
      reloadGroup={reloadGroup}
      onWorkspaceStale={onWorkspaceStale}
    />,
  );
}

describe("AssetGroupFilesBlock", () => {
  // Every asset renders as its own editable row with the file name, needed so
  // operators can review, regenerate, or remove each item individually.
  it("renders a row per asset", () => {
    renderBlock([makeAsset("a1", "notes.csv"), makeAsset("a2", "stock.csv")]);

    expect(screen.getByText("notes.csv")).toBeInTheDocument();
    expect(screen.getByText("stock.csv")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /regenerate/i })).toHaveLength(2);
  });

  // Empty groups show guidance instead of a bare list.
  it("shows the empty state when the group has no assets", () => {
    renderBlock([]);

    expect(
      screen.getByText(
        "Nothing in this group yet. Click Add asset to add a sendable file or reference.",
      ),
    ).toBeInTheDocument();
  });
});

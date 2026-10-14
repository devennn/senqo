import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  vi.mocked(api.post).mockResolvedValue({ description: "fresh" } as never);
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

describe("AssetGroupFilesBlock re-run summaries", () => {
  // Bulk re-run drafts and saves a fresh summary for every existing item in the group.
  it("re-runs and persists summaries for every asset", async () => {
    const user = userEvent.setup();
    renderBlock([makeAsset("a1", "notes.csv"), makeAsset("a2", "stock.csv")]);

    await user.click(screen.getByRole("button", { name: "Re-run summaries" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Re-run summaries" }));

    await waitFor(() => expect(reloadGroup).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith(
      "/api/user/workspace-asset-groups/g1/assets/a1/summarize",
      { persistDescription: true },
    );
    expect(api.post).toHaveBeenCalledWith(
      "/api/user/workspace-asset-groups/g1/assets/a2/summarize",
      { persistDescription: true },
    );
    expect(await screen.findByText("Summaries updated.")).toBeInTheDocument();
  });

  // One failing item must not block the rest; the failure count is surfaced to the operator.
  it("keeps going when one summary fails and reports the count", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockImplementation((async (path: string) => {
      if (String(path).includes("/a1/")) throw new Error("drive unavailable");
      return { description: "fresh" };
    }) as never);
    renderBlock([makeAsset("a1", "notes.csv"), makeAsset("a2", "stock.csv")]);

    await user.click(screen.getByRole("button", { name: "Re-run summaries" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Re-run summaries" }));

    expect(
      await screen.findByText("1 of 2 summaries could not be generated."),
    ).toBeInTheDocument();
    await waitFor(() => expect(reloadGroup).toHaveBeenCalledTimes(1));
  });

  // Nothing to re-run in an empty group.
  it("disables the re-run action when the group is empty", () => {
    renderBlock([]);
    expect(screen.getByRole("button", { name: "Re-run summaries" })).toBeDisabled();
  });
});

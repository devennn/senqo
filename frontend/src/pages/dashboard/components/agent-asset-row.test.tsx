import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AgentAssetRecord } from "@/types/repositories";
import { AgentAssetRow } from "./agent-asset-row";

const ASSET: AgentAssetRecord = {
  id: "asset-1",
  workspace_id: "ws-1",
  group_id: "group-1",
  file_name: "menu.pdf",
  storage_path: "path/menu.pdf",
  mime_type: "application/pdf",
  description: "",
  file_size_bytes: 1024,
  sort_order: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  preview_url: null,
};

const onDelete = vi.fn();
const onSaveDescription = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  onDelete.mockResolvedValue(undefined);
  onSaveDescription.mockResolvedValue(undefined);
});

function renderRow() {
  render(
    <AgentAssetRow asset={ASSET} onSaveDescription={onSaveDescription} onDelete={onDelete} />,
  );
}

describe("AgentAssetRow removal", () => {
  // Clicking Remove opens an in-app dialog instead of a browser alert → confirming removes the
  // asset through the callback, needed so destructive actions are explicit.
  it("AgentAssetRow → removes the asset after dialog confirmation", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/menu\.pdf.*removed from this agent/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(onDelete).toHaveBeenCalledWith("asset-1");
  });

  // Dismissing the dialog → the asset is kept, needed so a stray click cannot remove it by accident.
  it("AgentAssetRow → keeps the asset when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("menu.pdf")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminWorkspaceRecord } from "@/lib/admin-api";

const api = vi.hoisted(() => ({
  fetchAdminWorkspaces: vi.fn(),
  deleteAdminWorkspace: vi.fn(),
}));

vi.mock("@/lib/admin-api", () => api);

import { InstanceAdminWorkspacesSection } from "./instance-admin-workspaces-section";

const WORKSPACES: AdminWorkspaceRecord[] = [
  {
    id: "ws-1",
    name: "MasterArtist",
    owner_user_id: "user-1",
    owner_email: "deven@amplee.io",
    created_at: "2026-01-01T00:00:00.000Z",
    member_count: 2,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchAdminWorkspaces.mockResolvedValue(WORKSPACES);
  api.deleteAdminWorkspace.mockResolvedValue(undefined);
});

describe("InstanceAdminWorkspacesSection confirmations", () => {
  // Deleting a workspace opens an in-app dialog instead of a browser alert → confirming removes it
  // through the API and refreshes the list, needed so destructive actions are explicit.
  it("InstanceAdminWorkspacesSection → deletes a workspace after dialog confirmation", async () => {
    const user = userEvent.setup();
    render(<InstanceAdminWorkspacesSection />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/MasterArtist.*removed permanently/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(api.deleteAdminWorkspace).toHaveBeenCalledWith("ws-1");
    expect(api.fetchAdminWorkspaces).toHaveBeenCalledTimes(2);
  });

  // Dismissing the dialog → no API call happens, needed so a stray click cannot delete a workspace
  // by accident.
  it("InstanceAdminWorkspacesSection → keeps the workspace when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    render(<InstanceAdminWorkspacesSection />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(api.deleteAdminWorkspace).not.toHaveBeenCalled();
    expect(screen.getByText("MasterArtist")).toBeInTheDocument();
  });
});

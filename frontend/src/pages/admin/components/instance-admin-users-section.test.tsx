import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminPendingInviteRecord, AdminUserRecord } from "@/lib/admin-api";

const api = vi.hoisted(() => ({
  fetchAdminUsers: vi.fn(),
  sendAdminRegistrationInvite: vi.fn(),
  cancelAdminRegistrationInvite: vi.fn(),
  deleteAdminUser: vi.fn(),
  disableAdminUser: vi.fn(),
  enableAdminUser: vi.fn(),
  promoteAdminUser: vi.fn(),
  demoteAdminUser: vi.fn(),
}));

vi.mock("@/lib/admin-api", () => api);

import { InstanceAdminUsersSection } from "./instance-admin-users-section";

const USERS: AdminUserRecord[] = [
  {
    id: "user-1",
    email: "deven@amplee.io",
    created_at: "2026-01-01T00:00:00.000Z",
    is_instance_admin: true,
    disabled_at: null,
    owned_workspace_count: 1,
  },
  {
    id: "user-2",
    email: "zimin@savoroflife.com",
    created_at: "2026-02-01T00:00:00.000Z",
    is_instance_admin: false,
    disabled_at: null,
    owned_workspace_count: 0,
  },
];

const INVITES: AdminPendingInviteRecord[] = [
  {
    id: "invite-1",
    email: "invitee@example.com",
    created_at: "2026-10-01T00:00:00.000Z",
    expires_at: "2026-10-08T00:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchAdminUsers.mockResolvedValue({ users: USERS, pendingInvites: INVITES });
  api.deleteAdminUser.mockResolvedValue(undefined);
  api.cancelAdminRegistrationInvite.mockResolvedValue(undefined);
});

describe("InstanceAdminUsersSection confirmations", () => {
  // Deleting a user opens an in-app dialog instead of a browser alert → confirming removes the
  // user through the API and refreshes the list, needed so destructive actions are explicit.
  it("InstanceAdminUsersSection → deletes a user after dialog confirmation", async () => {
    const user = userEvent.setup();
    render(<InstanceAdminUsersSection currentUserId="user-1" />);

    const row = (await screen.findByText("zimin@savoroflife.com")).closest("li");
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/will be removed permanently/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(api.deleteAdminUser).toHaveBeenCalledWith("user-2");
    expect(api.fetchAdminUsers).toHaveBeenCalledTimes(2);
  });

  // Dismissing the delete dialog → no API call happens, needed so a stray click cannot delete a
  // user by accident.
  it("InstanceAdminUsersSection → keeps the user when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    render(<InstanceAdminUsersSection currentUserId="user-1" />);

    const row = (await screen.findByText("zimin@savoroflife.com")).closest("li");
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(api.deleteAdminUser).not.toHaveBeenCalled();
    expect(screen.getByText("zimin@savoroflife.com")).toBeInTheDocument();
  });

  // Cancelling a pending invite opens the dialog → confirming revokes it and removes the row,
  // needed so an invite sent by mistake can be withdrawn.
  it("InstanceAdminUsersSection → revokes a pending invite after dialog confirmation", async () => {
    const user = userEvent.setup();
    render(<InstanceAdminUsersSection currentUserId="user-1" />);

    const row = (await screen.findByText("invitee@example.com")).closest("li");
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Cancel" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/signup link sent to invitee@example.com/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel invite" }));

    expect(api.cancelAdminRegistrationInvite).toHaveBeenCalledWith("invite-1");
    expect(screen.queryByText("invitee@example.com")).not.toBeInTheDocument();
  });
});

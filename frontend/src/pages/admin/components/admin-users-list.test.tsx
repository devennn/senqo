import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminPendingInviteRecord, AdminUserRecord } from "@/lib/admin-api";
import { AdminUsersList } from "./admin-users-list";

const USERS: AdminUserRecord[] = [
  {
    id: "user-1",
    email: "deven@amplee.io",
    created_at: "2026-01-01T00:00:00.000Z",
    is_instance_admin: true,
    disabled_at: null,
    owned_workspace_count: 2,
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

const onUserAction = vi.fn();
const onCancelInvite = vi.fn();

function renderList() {
  render(
    <AdminUsersList
      users={USERS}
      pendingInvites={INVITES}
      currentUserId="user-1"
      busyUserId={null}
      onUserAction={onUserAction}
      onCancelInvite={onCancelInvite}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminUsersList", () => {
  // A pending invite exists → the email appears with an Invite pending status, needed so the admin
  // can see who was already invited before inviting someone else.
  it("AdminUsersList → shows pending invite emails with an Invite pending status", () => {
    renderList();

    expect(screen.getByText("invitee@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Invite pending/i)).toBeInTheDocument();
  });

  // Admin clicks Cancel on a pending invite → the invite is handed back to the caller for
  // revocation, needed so an invite sent by mistake can be withdrawn.
  it("AdminUsersList → requests cancellation when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancelInvite).toHaveBeenCalledWith(INVITES[0]);
  });

  // Admin clicks Delete on a registered user → the user action is handed back to the caller, needed
  // so the section can confirm and call the API. Self rows stay disabled, so target another user.
  it("AdminUsersList → requests the delete action when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderList();

    const row = screen.getByText("zimin@savoroflife.com").closest("li");
    await user.click(within(row as HTMLElement).getByRole("button", { name: "Delete" }));

    expect(onUserAction).toHaveBeenCalledWith("user-2", "delete");
  });
});

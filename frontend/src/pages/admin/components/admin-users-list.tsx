import { Button } from "@/components/ui/button";
import type { AdminPendingInviteRecord, AdminUserRecord } from "@/lib/admin-api";

export type AdminUserAction = "disable" | "enable" | "promote" | "demote" | "delete";

type Props = {
  users: AdminUserRecord[];
  pendingInvites: AdminPendingInviteRecord[];
  currentUserId: string;
  busyUserId: string | null;
  onUserAction: (userId: string, action: AdminUserAction) => void;
  onCancelInvite: (invite: AdminPendingInviteRecord) => void;
};

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function AdminUsersList({
  users,
  pendingInvites,
  currentUserId,
  busyUserId,
  onUserAction,
  onCancelInvite,
}: Props) {
  return (
    <ul className="divide-y divide-border">
      {pendingInvites.map((invite) => {
        return (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{invite.email}</p>
              <p className="text-xs text-muted-foreground">
                Invite pending · Expires {formatExpiry(invite.expires_at)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onCancelInvite(invite)}
            >
              Cancel
            </Button>
          </li>
        );
      })}
      {users.map((u) => {
        const disabled = u.disabled_at !== null;
        const isSelf = u.id === currentUserId;
        const busy = busyUserId === u.id;
        return (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{u.email}</p>
              <p className="text-xs text-muted-foreground">
                {u.is_instance_admin ? "Superadmin · " : ""}
                {disabled ? "Disabled · " : "Active · "}
                {u.owned_workspace_count} owned workspace
                {u.owned_workspace_count === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {disabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onUserAction(u.id, "enable")}
                >
                  Enable
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || isSelf}
                  onClick={() => onUserAction(u.id, "disable")}
                >
                  Disable
                </Button>
              )}
              {u.is_instance_admin ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || isSelf}
                  onClick={() => onUserAction(u.id, "demote")}
                >
                  Demote
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onUserAction(u.id, "promote")}
                >
                  Promote
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy || isSelf}
                onClick={() => onUserAction(u.id, "delete")}
              >
                Delete
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

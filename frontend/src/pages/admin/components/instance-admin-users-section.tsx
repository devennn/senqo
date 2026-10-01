import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelAdminRegistrationInvite,
  deleteAdminUser,
  demoteAdminUser,
  disableAdminUser,
  enableAdminUser,
  fetchAdminUsers,
  promoteAdminUser,
  type AdminPendingInviteRecord,
  type AdminUserRecord,
} from "@/lib/admin-api";
import { AdminInviteForm } from "@/pages/admin/components/admin-invite-form";
import { AdminUsersList, type AdminUserAction } from "@/pages/admin/components/admin-users-list";
import {
  AdminConfirmDialog,
  type PendingAdminConfirm,
} from "@/pages/admin/components/admin-confirm-dialog";

type Props = {
  currentUserId: string;
};

export function InstanceAdminUsersSection({ currentUserId }: Props) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [pendingInvites, setPendingInvites] = useState<AdminPendingInviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingAdminConfirm | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data.users);
      setPendingInvites(data.pendingInvites);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInvited = useCallback((invite: AdminPendingInviteRecord) => {
    setPendingInvites((prev) => [...prev, invite]);
  }, []);

  async function runUserAction(userId: string, action: AdminUserAction) {
    if (action === "delete") {
      const target = users.find((u) => u.id === userId);
      if (target) setPendingConfirm({ kind: "delete-user", user: target });
      return;
    }

    setBusyUserId(userId);
    setError(null);
    try {
      if (action === "disable") await disableAdminUser(userId);
      if (action === "enable") await enableAdminUser(userId);
      if (action === "promote") await promoteAdminUser(userId);
      if (action === "demote") await demoteAdminUser(userId);
      await load();
    } catch (err) {
      setError(String((err as Error).message));
    }
    setBusyUserId(null);
  }

  async function confirmPending() {
    if (!pendingConfirm) return;

    setConfirming(true);
    try {
      if (pendingConfirm.kind === "delete-user") {
        await deleteAdminUser(pendingConfirm.user.id);
        await load();
      } else {
        await cancelAdminRegistrationInvite(pendingConfirm.invite.id);
        setPendingInvites((prev) => prev.filter((p) => p.id !== pendingConfirm.invite.id));
      }
      setPendingConfirm(null);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="text-sm text-destructive">{error.replace(/_/g, " ")}</p>
        ) : null}

        <AdminInviteForm onInvited={handleInvited} />

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <AdminUsersList
            users={users}
            pendingInvites={pendingInvites}
            currentUserId={currentUserId}
            busyUserId={busyUserId}
            onUserAction={(userId, action) => void runUserAction(userId, action)}
            onCancelInvite={(invite) => setPendingConfirm({ kind: "cancel-invite", invite })}
          />
        )}

        <AdminConfirmDialog
          pending={pendingConfirm}
          isConfirming={confirming}
          onOpenChange={(open) => {
            if (!open) setPendingConfirm(null);
          }}
          onConfirm={confirmPending}
        />
      </CardContent>
    </Card>
  );
}

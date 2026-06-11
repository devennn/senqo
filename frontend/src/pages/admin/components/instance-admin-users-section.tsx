import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteAdminUser,
  demoteAdminUser,
  disableAdminUser,
  enableAdminUser,
  fetchAdminUsers,
  promoteAdminUser,
  sendAdminRegistrationInvite,
  type AdminUserRecord,
} from "@/lib/admin-api";

type Props = {
  currentUserId: string;
};

export function InstanceAdminUsersSection({ currentUserId }: Props) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsers(await fetchAdminUsers());
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      await sendAdminRegistrationInvite(inviteEmail.trim());
      setInviteEmail("");
    } catch (err) {
      setError(String((err as Error).message));
    }
    setInviting(false);
  }

  async function runAction(userId: string, action: () => Promise<void>) {
    setBusyUserId(userId);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(String((err as Error).message));
    }
    setBusyUserId(null);
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

        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-email">Invite to Senqo</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? "Sending…" : "Send invite"}
          </Button>
        </form>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-border">
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
                        onClick={() => void runAction(u.id, () => enableAdminUser(u.id))}
                      >
                        Enable
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || isSelf}
                        onClick={() => void runAction(u.id, () => disableAdminUser(u.id))}
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
                        onClick={() => void runAction(u.id, () => demoteAdminUser(u.id))}
                      >
                        Demote
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void runAction(u.id, () => promoteAdminUser(u.id))}
                      >
                        Promote
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy || isSelf}
                      onClick={() => {
                        if (!window.confirm(`Delete ${u.email}?`)) return;
                        void runAction(u.id, () => deleteAdminUser(u.id));
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

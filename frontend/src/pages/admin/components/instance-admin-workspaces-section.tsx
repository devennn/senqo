import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteAdminWorkspace,
  fetchAdminWorkspaces,
  type AdminWorkspaceRecord,
} from "@/lib/admin-api";

export function InstanceAdminWorkspacesSection() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setWorkspaces(await fetchAdminWorkspaces());
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete workspace “${name}”? This cannot be undone.`)) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteAdminWorkspace(id);
      await load();
    } catch (e) {
      setError(String((e as Error).message));
    }
    setDeletingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All workspaces</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {error ? (
          <p className="mb-4 text-sm text-destructive">{error.replace(/_/g, " ")}</p>
        ) : null}
        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading…</p>
        ) : workspaces.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No workspaces yet.</p>
        ) : (
          workspaces.map((ws) => (
            <div key={ws.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{ws.name}</p>
                <p className="text-xs text-muted-foreground">
                  Owner: {ws.owner_email ?? ws.owner_user_id}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deletingId === ws.id}
                onClick={() => void handleDelete(ws.id, ws.name)}
              >
                Delete
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileWorkspaceCard } from "@/pages/settings/components/profile-settings-cards";
import { WorkspaceStorageUsageCard } from "@/pages/settings/components/workspace-storage-usage-card";
import { SettingsPageLoader } from "@/pages/settings/components/settings-page-loader";

function queryMessage(raw: string): string {
  return decodeURIComponent(raw).replace(/_/g, " ");
}

export default function WorkspacePage() {
  const { bundle, loading, loadError, reload, saveWorkspaceName } = useProfileSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, TRANSIENT_SUCCESS_FEEDBACK_MS);
      return () => clearTimeout(timer);
    }
  }, [success, error, setSearchParams]);

  async function handleWorkspaceSave(name: string) {
    setBusy(true);
    try {
      await saveWorkspaceName(name);
      setSearchParams({ success: "workspace_updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "workspace_update_failed";
      const friendly = message === "forbidden" ? "workspace_rename_not_allowed" : message;
      setSearchParams({ error: friendly });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !bundle) {
    return <SettingsPageLoader label="Loading workspace" />;
  }

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">Name, storage usage, and membership for this workspace.</p>

      {error ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {queryMessage(error)}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-md border border-primary/40 bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          {queryMessage(success)}
        </p>
      ) : null}

      {loadError ? (
        <div className="mt-8 space-y-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p className="text-destructive">{queryMessage(loadError)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : bundle ? (
        <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-6">
          <WorkspaceStorageUsageCard storage={bundle.storage} />
          {bundle.workspace ? (
            <ProfileWorkspaceCard workspace={bundle.workspace} loading={busy} onSaveName={handleWorkspaceSave} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Workspace</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Workspace information is not available for this account.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </section>
  );
}

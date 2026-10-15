import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/spinner";
import { GoogleDriveIcon } from "@/components/icons/google-drive-icon";
import { useWorkspaceApps } from "@/hooks/useWorkspaceApps";
import { DriveAccessScopeFields } from "@/pages/dashboard/connect/components/drive-access-scope-fields";

export function AppsPanel() {
  const {
    apps,
    composioConfigured,
    loading,
    error,
    connectGoogleDrive,
    completeGoogleDrive,
    disconnectGoogleDrive,
    updateDriveAccessScope,
    listDriveItems,
  } = useWorkspaceApps();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const drive = apps.find((app) => app.toolkit === "googledrive");

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected !== "googledrive") return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setActionError(null);
      try {
        await completeGoogleDrive();
      } catch (err) {
        if (!cancelled) {
          setActionError(
            err instanceof Error ? err.message : "Could not complete Drive connect",
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
        const next = new URLSearchParams(searchParams);
        next.delete("connected");
        setSearchParams(next, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, completeGoogleDrive, setSearchParams]);

  if (loading) {
    return <PageLoader label="Loading apps" />;
  }

  return (
    <div className="space-y-4">
      {!composioConfigured && (
        <p className="text-sm text-muted-foreground">
          Set <code className="text-xs">COMPOSIO_API_KEY</code> on the backend to enable Apps.
        </p>
      )}
      {(error || actionError) && (
        <p className="text-sm text-destructive">{actionError ?? error}</p>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <GoogleDriveIcon className="size-8" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">Google Drive</CardTitle>
            <p className="text-sm text-muted-foreground">
              One account per workspace. Optionally limit references
              (Knowledge → Assets) to a folder or single file.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              Status:{" "}
              <strong>
                {drive?.status === "active"
                  ? "Connected"
                  : drive?.status === "disconnected"
                    ? "Disconnected"
                    : "Not connected"}
              </strong>
            </span>
            {drive?.status === "active" ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy || !composioConfigured}
                onClick={() => {
                  setBusy(true);
                  setActionError(null);
                  void disconnectGoogleDrive()
                    .catch((err) =>
                      setActionError(
                        err instanceof Error ? err.message : "Disconnect failed",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={busy || !composioConfigured}
                onClick={() => {
                  setBusy(true);
                  setActionError(null);
                  void connectGoogleDrive().catch((err) => {
                    setActionError(
                      err instanceof Error ? err.message : "Connect failed",
                    );
                    setBusy(false);
                  });
                }}
              >
                <GoogleDriveIcon className="size-4" />
                Connect Google Drive
              </Button>
            )}
          </div>

          {drive?.status === "active" && (
            <DriveAccessScopeFields
              drive={drive}
              listDriveItems={listDriveItems}
              updateDriveAccessScope={updateDriveAccessScope}
              disabled={busy || !composioConfigured}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

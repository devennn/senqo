import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspaceSecrets } from "@/hooks/useWorkspaceSecrets";
import { SecretsCreateDialog } from "@/pages/settings/components/secrets-create-dialog";
import { SettingsPageLoader } from "@/pages/settings/components/settings-page-loader";

export default function SecretsPage() {
  const {
    items,
    loading,
    loadError,
    creating,
    deletingId,
    createResult,
    reload,
    createSecret,
    deleteSecret,
    clearCreateResult,
  } = useWorkspaceSecrets();

  if (loading) return <SettingsPageLoader label="Loading secrets" />;

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Secrets</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Workspace environment variables for custom agent tools. Values are shown once on create.
      </p>
      {loadError ? (
        <p className="mt-4 text-sm text-destructive">{loadError}</p>
      ) : null}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Workspace secrets</CardTitle>
            <SecretsCreateDialog
              creating={creating}
              createResult={createResult}
              clearCreateResult={clearCreateResult}
              onCreate={createSecret}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No secrets yet.</p>
          ) : null}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-mono font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.description || (item.value_hint ? `…${item.value_hint}` : "No description")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={deletingId === item.id}
                onClick={() => { void deleteSecret(item.id).then(() => reload({ silent: true })); }}
              >
                Delete
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

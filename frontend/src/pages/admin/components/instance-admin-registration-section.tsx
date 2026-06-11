import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAdminSettings, patchAdminSettings } from "@/lib/admin-api";

export function InstanceAdminRegistrationSection() {
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(false);
  const [baseline, setBaseline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAdminSettings();
      setAllowPublicRegistration(data.allowPublicRegistration);
      setBaseline(data.allowPublicRegistration);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = allowPublicRegistration !== baseline;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await patchAdminSettings(allowPublicRegistration);
      setBaseline(allowPublicRegistration);
    } catch (e) {
      setError(String((e as Error).message));
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Public registration</CardTitle>
        <Button type="button" disabled={!dirty || saving} onClick={() => void handleSave()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-sm text-destructive">{error.replace(/_/g, " ")}</p>
        ) : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={allowPublicRegistration}
              onChange={(e) => setAllowPublicRegistration(e.target.checked)}
            />
            Allow anyone to sign up without an invite
          </label>
        )}
      </CardContent>
    </Card>
  );
}

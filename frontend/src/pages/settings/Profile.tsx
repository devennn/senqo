import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { Button } from "@/components/ui/button";
import { ProfilePersonalCard, ProfilePasswordCard } from "@/pages/settings/components/profile-account-cards";
import { SettingsPageLoader } from "@/pages/settings/components/settings-page-loader";

function queryMessage(raw: string): string {
  return decodeURIComponent(raw).replace(/_/g, " ");
}

export default function ProfilePage() {
  const { workspaceId } = useWorkspace();
  const { bundle, loading, loadError, reload, savePersonal } = useProfileSettings();
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

  async function handleSavePersonal(firstName: string, lastName: string) {
    if (!bundle) return;
    setBusy(true);
    try {
      await savePersonal(firstName.trim(), lastName.trim());
      setSearchParams({ success: "profile_updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "profile_update_failed";
      setSearchParams({ error: message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePassword(newPassword: string) {
    setBusy(true);
    try {
      await api.post("/api/user/profile/password", { newPassword }, { workspaceId });
      setSearchParams({ success: "password_updated" });
    } catch {
      setSearchParams({ error: "password_update_failed" });
      throw new Error("password_update_failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !bundle) {
    return <SettingsPageLoader label="Loading profile" />;
  }

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your account name, email, and password.</p>

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
        <div className="mt-6 grid w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start xl:gap-8">
          <ProfilePersonalCard profile={bundle.profile} busy={busy} onSavePersonal={handleSavePersonal} />
          <ProfilePasswordCard busy={busy} onSavePassword={handleSavePassword} />
        </div>
      ) : null}
    </section>
  );
}

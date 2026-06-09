import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserProfileSettingsApiResponse } from "@/types/repositories";

export function ProfilePersonalCard(props: {
  profile: UserProfileSettingsApiResponse["profile"];
  busy: boolean;
  onSavePersonal: (firstName: string, lastName: string) => Promise<void>;
}) {
  const { profile, busy, onSavePersonal } = props;
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);

  useEffect(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
  }, [profile.firstName, profile.lastName]);

  const baselineFirst = profile.firstName.trim();
  const baselineLast = profile.lastName.trim();
  const isDirty =
    firstName.trim() !== baselineFirst || lastName.trim() !== baselineLast;

  async function copyAccountId() {
    try {
      await navigator.clipboard.writeText(profile.id);
      toast.success("Account ID copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal information</CardTitle>
        <CardDescription>Your sign-in identity and display name.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Email</Label>
          <p className="text-sm">{profile.email ?? "—"}</p>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Account ID</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="block flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 text-xs">{profile.id}</code>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void copyAccountId()}>
              Copy ID
            </Button>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isDirty || busy) return;
            void onSavePersonal(firstName, lastName);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" value={firstName} onChange={(ev) => setFirstName(ev.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" value={lastName} onChange={(ev) => setLastName(ev.target.value)} />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={busy || !isDirty}>
            Save personal details
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ProfilePasswordCard(props: {
  busy: boolean;
  onSavePassword: (newPassword: string) => Promise<void>;
}) {
  const { busy, onSavePassword } = props;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canSubmit =
    !busy &&
    newPassword.length >= 8 &&
    confirmPassword.length >= 8 &&
    newPassword === confirmPassword;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Choose a strong password you do not reuse elsewhere.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            void (async () => {
              try {
                await onSavePassword(newPassword);
                setNewPassword("");
                setConfirmPassword("");
              } catch {
                /* Parent sets URL error state */
              }
            })();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
            />
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={!canSubmit}>
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

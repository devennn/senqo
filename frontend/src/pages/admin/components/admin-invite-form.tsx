import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendAdminRegistrationInvite, type AdminPendingInviteRecord } from "@/lib/admin-api";

const INVITE_ERROR_COPY: Record<string, string> = {
  public_registration_enabled:
    "Public registration is on, so new teammates can sign up without an invite — invites are unavailable until you turn it off in Public registration above.",
};

type Props = {
  onInvited: (invite: AdminPendingInviteRecord) => void;
};

export function AdminInviteForm({ onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    setEmailFailed(false);
    try {
      const { emailSent, invite } = await sendAdminRegistrationInvite(email.trim());
      onInvited(invite);
      setEmail("");
      setEmailFailed(!emailSent);
    } catch (err) {
      setError(String((err as Error).message));
    }
    setInviting(false);
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="invite-email">Invite to Senqo</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={inviting}>
          {inviting ? "Sending…" : "Send invite"}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive">
          {INVITE_ERROR_COPY[error] ?? error.replace(/_/g, " ")}
        </p>
      ) : null}
      {emailFailed ? (
        <p className="text-sm text-destructive">
          Invite created, but the email could not be sent. Check the SMTP configuration.
        </p>
      ) : null}
    </form>
  );
}

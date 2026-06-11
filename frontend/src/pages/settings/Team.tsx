import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsPageLoader } from "@/pages/settings/components/settings-page-loader";
import type { TeamMemberRecord } from "@/types/repositories";

export default function TeamPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
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

  const loadMembers = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.get<{ members: TeamMemberRecord[] }>("/api/user/team");
      setMembers(res.members ?? []);
    } catch (e) {
      setMembers([]);
      setLoadError(String((e as Error).message));
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleAddMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await api.post("/api/user/team", { email: String(data.get("email") ?? "") });
      await loadMembers();
      setSearchParams({ success: "member_added" });
      e.currentTarget.reset();
    } catch (err) {
      setSearchParams({ error: String((err as Error).message) });
    }
    setAddLoading(false);
  }

  async function handleRegistrationInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteLoading(true);
    const data = new FormData(e.currentTarget);
    try {
      await api.post("/api/user/team/registration-invite", {
        email: String(data.get("inviteEmail") ?? ""),
      });
      setSearchParams({ success: "invite_sent" });
      e.currentTarget.reset();
    } catch (err) {
      setSearchParams({ error: String((err as Error).message) });
    }
    setInviteLoading(false);
  }

  if (loadingMembers) {
    return <SettingsPageLoader label="Loading team" />;
  }

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Invite people to Senqo or add existing users to this workspace.
      </p>

      {loadError ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError.replace(/_/g, " ")}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {decodeURIComponent(error).replace(/_/g, " ")}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-md border border-primary/40 bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          {decodeURIComponent(success).replace(/_/g, " ")}
        </p>
      ) : null}

      <div className="mt-6 flex w-full max-w-xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite to Senqo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Send a signup link when public registration is off.
            </p>
            <form onSubmit={handleRegistrationInvite} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 space-y-2">
                <Label htmlFor="inviteEmail">Email address</Label>
                <Input
                  id="inviteEmail"
                  name="inviteEmail"
                  type="email"
                  placeholder="colleague@company.com"
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto" disabled={inviteLoading}>
                  Send invite
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add to workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              User must already have a Senqo account.
            </p>
            <form onSubmit={handleAddMember} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" name="email" type="email" placeholder="colleague@company.com" required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full sm:w-auto" disabled={addLoading}>
                  Add member
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.email || "Unknown member"}</p>
                  <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                </div>
              </div>
            ))}
            {members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No team members yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { connectionPhonesToDigits } from "@/lib/handoff-phone";
import { teamMemberErrorMessage } from "@/lib/team-member-errors";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { useIsWorkspaceOwner } from "@/hooks/useIsWorkspaceOwner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsPageLoader } from "@/pages/settings/components/settings-page-loader";
import { TeamMembersCard } from "@/pages/settings/components/team-members-card";
import type { TeamMemberRecord, WhatsappConnection } from "@/types/repositories";

export default function TeamPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { isOwner, loading: ownerLoading } = useIsWorkspaceOwner();
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [connections, setConnections] = useState<WhatsappConnection[]>([]);
  const [connectionPhoneDigits, setConnectionPhoneDigits] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
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
      const [teamRes, connectionsRes] = await Promise.all([
        api.get<{ members: TeamMemberRecord[] }>("/api/user/team"),
        api.get<{ connections: WhatsappConnection[] }>("/api/user/connections"),
      ]);
      const nextConnections = connectionsRes.connections ?? [];
      setMembers(teamRes.members ?? []);
      setConnections(nextConnections);
      setConnectionPhoneDigits(
        connectionPhonesToDigits(nextConnections.map((c) => c.phone_number)),
      );
    } catch (e) {
      setMembers([]);
      setConnections([]);
      setConnectionPhoneDigits([]);
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

  if (loadingMembers || ownerLoading) {
    return <SettingsPageLoader label="Loading team" />;
  }

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add people who already have a Senqo account to this workspace.
      </p>

      {loadError ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {teamMemberErrorMessage(decodeURIComponent(error))}
        </p>
      ) : null}
      {success === "member_added" ? (
        <p className="mt-4 rounded-md border border-primary/40 bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          Member added.
        </p>
      ) : null}

      <div className="mt-6 flex w-full flex-col gap-6">
        {isOwner ? (
          <Card>
            <CardHeader>
              <CardTitle>Add to workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                The person must already have a Senqo account.
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
        ) : null}

        <TeamMembersCard
          members={members}
          currentUserId={user?.id}
          isOwner={Boolean(isOwner)}
          connections={connections}
          connectionPhoneDigits={connectionPhoneDigits}
          onChanged={loadMembers}
        />
      </div>
    </section>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { teamMemberErrorMessage } from "@/lib/team-member-errors";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TeamMemberRecord } from "@/types/repositories";

type ActorRole = "owner" | "admin" | "member" | null;
type AssignableRole = "admin" | "member";

function roleLabel(role: "owner" | AssignableRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function TeamMemberRoleControl({
  member,
  actorRole,
  onChanged,
}: {
  member: TeamMemberRecord;
  actorRole: ActorRole;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChange =
    member.role !== "owner" &&
    (actorRole === "owner" || (actorRole === "admin" && member.role === "member"));

  async function changeRole(role: AssignableRole) {
    if (busy || !canChange || role === member.role) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch("/api/user/team/role", { userId: member.userId, role });
      await onChanged();
    } catch (err) {
      setError(teamMemberErrorMessage((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={busy || !canChange}
              aria-label={`Change role for ${member.email ?? "this member"}`}
            />
          }
        >
          <span>{roleLabel(member.role)}</span>
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => void changeRole("member")}>
            Member
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void changeRole("admin")}>
            Admin
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

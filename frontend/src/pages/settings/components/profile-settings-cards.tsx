import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserProfileSettingsWorkspace } from "@/types/repositories";

export function ProfileWorkspaceCard(props: {
  workspace: UserProfileSettingsWorkspace;
  loading: boolean;
  onSaveName: (name: string) => Promise<void>;
}) {
  const { workspace, loading, onSaveName } = props;
  const [name, setName] = useState(workspace.name);

  useEffect(() => {
    setName(workspace.name);
  }, [workspace.name]);

  const trimmed = name.trim();
  const baseline = workspace.name.trim();
  const isDirty = trimmed !== baseline;
  const canEdit = workspace.role === "owner";

  const created = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: undefined,
  }).format(new Date(workspace.createdAt));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit || !isDirty || loading || trimmed.length === 0) return;
    await onSaveName(trimmed);
  }

  async function copyWorkspaceId() {
    try {
      await navigator.clipboard.writeText(workspace.id);
      toast.success("Workspace ID copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Name and identifiers for this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Workspace ID</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="block flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 text-xs">{workspace.id}</code>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void copyWorkspaceId()}>
              Copy ID
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Useful when contacting support.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Created <span className="text-foreground">{created}</span>
          {workspace.role === "member" ? (
            <span className="ml-2 rounded-md border border-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Member
            </span>
          ) : null}
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspaceName">Workspace name</Label>
            <Input
              id="workspaceName"
              name="workspaceName"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              disabled={!canEdit || loading}
              maxLength={120}
              required
            />
          </div>
          {!canEdit ? (
            <p className="text-sm text-muted-foreground">Only the workspace owner can change the workspace name.</p>
          ) : null}
          {canEdit ? (
            <Button type="submit" className="w-full sm:w-auto" disabled={loading || !isDirty || trimmed.length === 0}>
              Save workspace
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

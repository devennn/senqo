import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserProfileSettingsWorkspace } from "@/types/repositories";

function supportedTimeZones(current: string): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? ["UTC"];
  return zones.includes(current) ? zones : [current, ...zones];
}

export function ProfileWorkspaceCard(props: {
  workspace: UserProfileSettingsWorkspace;
  loading: boolean;
  onSave: (patch: { name?: string; timezone?: string }) => Promise<void>;
}) {
  const { workspace, loading, onSave } = props;
  const [name, setName] = useState(workspace.name);
  const [timezone, setTimezone] = useState(workspace.timezone);
  const timezoneOptions = supportedTimeZones(workspace.timezone);

  useEffect(() => {
    setName(workspace.name);
  }, [workspace.name]);

  useEffect(() => {
    setTimezone(workspace.timezone);
  }, [workspace.timezone]);

  const trimmed = name.trim();
  const baseline = workspace.name.trim();
  const isDirty = trimmed !== baseline || timezone !== workspace.timezone;
  const canEdit = workspace.role === "owner";

  const created = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: undefined,
  }).format(new Date(workspace.createdAt));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit || !isDirty || loading || trimmed.length === 0) return;
    const patch: { name?: string; timezone?: string } = {};
    if (trimmed !== baseline) patch.name = trimmed;
    if (timezone !== workspace.timezone) patch.timezone = timezone;
    await onSave(patch);
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
        <CardDescription>Name, timezone, and identifiers for this workspace.</CardDescription>
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
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="workspaceTimezone">Timezone</Label>
              <InlineHelpHint label="About the workspace timezone">
                <p>Used for the agent's current time and to check opening hours, appointment times, and cutoffs.</p>
                <p>Defaults to UTC until changed.</p>
              </InlineHelpHint>
            </div>
            <select
              id="workspaceTimezone"
              name="workspaceTimezone"
              value={timezone}
              onChange={(ev) => setTimezone(ev.target.value)}
              disabled={!canEdit || loading}
              className="h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors focus-visible:border-2 focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
          {!canEdit ? (
            <p className="text-sm text-muted-foreground">Only the workspace owner can change workspace settings.</p>
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

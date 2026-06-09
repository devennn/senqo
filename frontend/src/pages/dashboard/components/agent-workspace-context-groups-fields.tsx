import { Link } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import type { AgentWorkspaceContextGroupsFieldsProps } from "@/types/ui";

export function AgentWorkspaceContextGroupsFields({
  groups,
  selectedIds,
  contextTabHref,
  subsectionDirty,
  saving,
}: AgentWorkspaceContextGroupsFieldsProps) {
  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Label className="flex shrink-0 items-center gap-2">
            <BookMarked className="size-3.5 text-muted-foreground" />
            Workspace context
          </Label>
          <InlineHelpHint label="About workspace context">
            <p>
              Stable facts grouped by topic. Select the sets this agent should use; create or edit groups on the Context tab.
            </p>
          </InlineHelpHint>
        </div>
        {subsectionDirty ? (
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {groups.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
              <input type="checkbox" name="contextGroups" value={group.id} defaultChecked={selectedIds.has(group.id)} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{group.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {group.entry_count} {group.entry_count === 1 ? "entry" : "entries"}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          None yet. Open the{" "}
          <Link to={contextTabHref} className="font-medium text-primary underline-offset-4 hover:underline">
            Context
          </Link>{" "}
          tab to add fact groups, then return here to attach them.
        </p>
      )}
    </fieldset>
  );
}

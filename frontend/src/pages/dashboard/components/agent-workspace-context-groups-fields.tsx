import { Link } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { AgentAttachCheckboxList } from "@/pages/dashboard/components/agent-attach-checkbox-list";
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
        <AgentAttachCheckboxList
          fieldName="contextGroups"
          items={groups.map((group) => ({
            id: group.id,
            name: group.name,
            hint: `${group.entry_count} ${group.entry_count === 1 ? "entry" : "entries"}`,
          }))}
          selectedIds={selectedIds}
        />
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

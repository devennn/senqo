import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { AgentAttachCheckboxList } from "@/pages/dashboard/components/agent-attach-checkbox-list";
import type { AgentHandoffTopicGroupsFieldsProps } from "@/types/ui";

export function AgentHandoffTopicGroupsFields({
  groups,
  selectedIds,
  handoffTabHref,
  subsectionDirty,
  saving,
}: AgentHandoffTopicGroupsFieldsProps) {
  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Label className="flex shrink-0 items-center gap-2">
            <Users className="size-3.5 text-muted-foreground" />
            Topics that need a human
          </Label>
          <InlineHelpHint label="About handing off conversations">
            <p>
              Situations where this agent should switch the chat to a teammate. Selected topic groups are
              included in the agent prompt. Add or edit topics on the Human handoff tab.
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
          fieldName="handoffTopicGroups"
          items={groups.map((group) => ({
            id: group.id,
            name: group.name,
            hint: `${group.entry_count} ${group.entry_count === 1 ? "topic" : "topics"}`,
          }))}
          selectedIds={selectedIds}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          None yet. Open the{" "}
          <Link
            to={handoffTabHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Human handoff
          </Link>{" "}
          tab to add topic groups, then return here to attach them.
        </p>
      )}
    </fieldset>
  );
}

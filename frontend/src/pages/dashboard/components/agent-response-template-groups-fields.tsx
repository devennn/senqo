import { Link } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { AgentAttachCheckboxList } from "@/pages/dashboard/components/agent-attach-checkbox-list";
import type { AgentResponseTemplateGroupsFieldsProps } from "@/types/ui";

export function AgentResponseTemplateGroupsFields({
  groups,
  selectedIds,
  templatesTabHref,
  subsectionDirty,
  saving,
}: AgentResponseTemplateGroupsFieldsProps) {
  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Label className="flex shrink-0 items-center gap-2">
            <MessagesSquare className="size-3.5 text-muted-foreground" />
            Response templates
          </Label>
          <InlineHelpHint label="About response templates">
            <p>
              Saved question-and-answer-style replies the AI must use exactly on WhatsApp (same facts and wording), translated to match the customer&apos;s language when needed. Select the template sets that apply to this agent; add or edit them on the Response templates tab.
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
          fieldName="responseTemplateGroups"
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
          <Link
            to={templatesTabHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Response templates
          </Link>{" "}
          tab to add saved WhatsApp replies, then return here to attach them.
        </p>
      )}
    </fieldset>
  );
}

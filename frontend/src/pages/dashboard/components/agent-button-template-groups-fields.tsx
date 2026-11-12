import { Link } from "react-router-dom";
import { MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { AgentAttachCheckboxList } from "@/pages/dashboard/components/agent-attach-checkbox-list";
import type { AgentButtonTemplateGroupsFieldsProps } from "@/types/ui";

export function AgentButtonTemplateGroupsFields({
  groups,
  selectedIds,
  buttonsTabHref,
  subsectionDirty,
  saving,
}: AgentButtonTemplateGroupsFieldsProps) {
  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Label className="flex shrink-0 items-center gap-2">
            <MousePointerClick className="size-3.5 text-muted-foreground" />
            Button templates
          </Label>
          <InlineHelpHint label="About button templates">
            <p>
              Ready-made WhatsApp messages with interactive buttons (quick reply, link, call, copy code) the AI
              can send when a choice or confirmation fits the conversation. The message is sent exactly as
              authored. Select the sets that apply to this agent; add or edit them on the Button templates tab.
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
          fieldName="buttonTemplateGroups"
          items={groups.map((group) => ({
            id: group.id,
            name: group.name,
            hint: `${group.entry_count} ${group.entry_count === 1 ? "template" : "templates"}`,
          }))}
          selectedIds={selectedIds}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          None yet. Open the{" "}
          <Link
            to={buttonsTabHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Button templates
          </Link>{" "}
          tab to add interactive button messages, then return here to attach them.
        </p>
      )}
    </fieldset>
  );
}

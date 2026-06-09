import { Link } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
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
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((group) => (
            <label
              key={group.id}
              className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="responseTemplateGroups"
                value={group.id}
                defaultChecked={selectedIds.has(group.id)}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{group.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {group.entry_count}{" "}
                  {group.entry_count === 1 ? "entry" : "entries"}
                </span>
              </span>
            </label>
          ))}
        </div>
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

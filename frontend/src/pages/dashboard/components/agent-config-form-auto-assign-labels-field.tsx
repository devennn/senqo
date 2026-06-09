import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AgentConfigFormAutoAssignLabelsFieldProps } from "@/types/ui";

/** Checkbox + copy for syncing AI-derived conversation labels (agent setup profile form). */
export function AgentConfigFormAutoAssignLabelsField({
  defaultChecked,
  sectionDirty,
  saving,
}: AgentConfigFormAutoAssignLabelsFieldProps) {
  const saveDisabled = saving || !sectionDirty;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
      <input
        id="autoAssignConversationLabels"
        name="autoAssignConversationLabels"
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 size-4 rounded border-border"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="autoAssignConversationLabels" className="text-sm font-medium leading-tight">
            Auto-assign conversation labels
          </Label>
          {sectionDirty ? (
            <Button type="submit" size="sm" disabled={saveDisabled}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          When on, the agent can sync AI-sourced labels on a chat using your workspace label definitions.
          Manual labels you set in the dashboard are not overwritten by the agent.
        </p>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { AgentAttachCheckboxList } from "@/pages/dashboard/components/agent-attach-checkbox-list";
import type { AgentAssetGroupsFieldsProps } from "@/types/ui";

export function AgentAssetGroupsFields({
  groups,
  selectedIds,
  assetsTabHref,
  subsectionDirty,
  saving,
}: AgentAssetGroupsFieldsProps) {
  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Label className="flex shrink-0 items-center gap-2">
            <FolderOpen className="size-3.5 text-muted-foreground" />
            Assets
          </Label>
          <InlineHelpHint label="About agent assets">
            <p>
              Files the agent can send on WhatsApp. Each file needs a specific description the AI
              reads in its instructions; the agent decides when to send. References in the same groups are
              re-read by the agent at chat time. Select groups here; edit files and references on Knowledge → Assets.
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
          fieldName="assetGroups"
          items={groups.map((group) => ({
            id: group.id,
            name: group.name,
            hint: `${group.asset_count} ${group.asset_count === 1 ? "item" : "items"}`,
          }))}
          selectedIds={selectedIds}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          None yet. Open the{" "}
          <Link to={assetsTabHref} className="font-medium text-primary underline-offset-4 hover:underline">
            Assets
          </Link>{" "}
          tab to add file groups, then return here to attach them.
        </p>
      )}
    </fieldset>
  );
}

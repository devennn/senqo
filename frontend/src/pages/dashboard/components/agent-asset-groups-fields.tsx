import { Link } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
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
              Files the agent can send on WhatsApp. Each file needs a specific &quot;what is this about&quot; description the AI
              reads in its instructions; the agent decides when to send. Select groups here; edit files on the Assets tab.
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
              <input type="checkbox" name="assetGroups" value={group.id} defaultChecked={selectedIds.has(group.id)} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{group.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {group.asset_count} {group.asset_count === 1 ? "file" : "files"}
                </span>
              </span>
            </label>
          ))}
        </div>
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

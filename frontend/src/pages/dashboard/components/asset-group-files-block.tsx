import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ASSETS_MAX_PER_GROUP } from "@/lib/asset-groups-limits";
import { api } from "@/lib/api";
import { AgentAssetRow } from "@/pages/dashboard/components/agent-asset-row";
import { AssetAddDialog } from "@/pages/dashboard/components/asset-add-dialog";
import type { AgentAssetRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  assets: AgentAssetRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

export function AssetGroupFilesBlock({ groupId, assets, reloadGroup, onWorkspaceStale }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  async function handleAdded() {
    setAddOpen(false);
    await reloadGroup();
    await onWorkspaceStale();
  }

  async function saveDescription(assetId: string, description: string) {
    await api.patch(`/api/user/workspace-asset-groups/${groupId}/assets/${assetId}`, { description });
    await reloadGroup();
  }

  /** AI rewrite of an asset description; the operator still saves the draft manually. */
  async function summarizeDescription(assetId: string): Promise<string> {
    const res = await api.post<{ description: string }>(
      `/api/user/workspace-asset-groups/${groupId}/assets/${assetId}/summarize`,
      {},
    );
    return res.description;
  }

  async function removeAsset(assetId: string) {
    await api.delete(`/api/user/workspace-asset-groups/${groupId}/assets/${assetId}`);
    await reloadGroup();
    await onWorkspaceStale();
  }

  const atCap = assets.length >= ASSETS_MAX_PER_GROUP;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {assets.length}/{ASSETS_MAX_PER_GROUP} items
        </p>
        <Button type="button" size="sm" disabled={atCap} onClick={() => setAddOpen(true)}>
          Add asset
        </Button>
      </div>

      {assets.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing in this group yet. Click Add asset to add a sendable file or reference.
        </p>
      ) : (
        <ul className="space-y-3">
          {assets.map((asset) => (
            <AgentAssetRow
              key={asset.id}
              asset={asset}
              onSaveDescription={saveDescription}
              onSummarize={summarizeDescription}
              onDelete={removeAsset}
            />
          ))}
        </ul>
      )}

      <AssetAddDialog
        groupId={groupId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={handleAdded}
      />
    </div>
  );
}

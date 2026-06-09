import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ASSETS_MAX_PER_GROUP } from "@/lib/asset-groups-limits";
import { validateWorkspaceAssetFile } from "@/lib/workspace-asset-limits";
import { api } from "@/lib/api";
import { AgentAssetRow } from "@/pages/dashboard/components/agent-asset-row";
import { AgentAssetUploadForm } from "@/pages/dashboard/components/agent-asset-upload-form";
import type { AgentAssetRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  assets: AgentAssetRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

export function AssetGroupFilesBlock({ groupId, assets, reloadGroup, onWorkspaceStale }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  async function handleUpload(file: File, description: string) {
    const fileCheck = validateWorkspaceAssetFile(file);
    if (!fileCheck.ok) {
      throw new Error(fileCheck.message);
    }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("description", description);
    await api.postForm(`/api/user/workspace-asset-groups/${groupId}/assets`, formData);
    setAddOpen(false);
    await reloadGroup();
    await onWorkspaceStale();
  }

  async function saveDescription(assetId: string, description: string) {
    await api.patch(`/api/user/workspace-asset-groups/${groupId}/assets/${assetId}`, { description });
    await reloadGroup();
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
          {assets.length}/{ASSETS_MAX_PER_GROUP} files
        </p>
        <Button type="button" size="sm" disabled={atCap} onClick={() => setAddOpen(true)}>
          Add asset
        </Button>
      </div>

      {assets.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          No files in this group yet. Click Add asset to upload one.
        </p>
      ) : (
        <ul className="space-y-3">
          {assets.map((asset) => (
            <AgentAssetRow
              key={asset.id}
              asset={asset}
              onSaveDescription={saveDescription}
              onDelete={removeAsset}
            />
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add asset</DialogTitle>
            <DialogDescription>
              Upload a file, then describe what it contains in specific terms for the AI.
            </DialogDescription>
          </DialogHeader>
          <AgentAssetUploadForm disabled={false} onUpload={handleUpload} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

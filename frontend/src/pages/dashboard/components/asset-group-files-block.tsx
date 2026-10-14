import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTransientBooleanReset } from "@/hooks/useTransientBooleanReset";
import { ASSETS_MAX_PER_GROUP } from "@/lib/asset-groups-limits";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { api } from "@/lib/api";
import { AgentAssetRow } from "@/pages/dashboard/components/agent-asset-row";
import { AssetAddDialog } from "@/pages/dashboard/components/asset-add-dialog";
import { AssetRerunSummariesDialog } from "@/pages/dashboard/components/asset-rerun-summaries-dialog";
import type { AgentAssetRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  assets: AgentAssetRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

export function AssetGroupFilesBlock({ groupId, assets, reloadGroup, onWorkspaceStale }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [rerunOpen, setRerunOpen] = useState(false);
  const [rerunProgress, setRerunProgress] = useState<{ done: number; total: number } | null>(null);
  const [rerunFailed, setRerunFailed] = useState<number | null>(null);
  const [rerunDone, setRerunDone] = useState(false);
  useTransientBooleanReset(rerunDone, setRerunDone, TRANSIENT_SUCCESS_FEEDBACK_MS);

  const rerunRunning = rerunProgress !== null;

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

  /** Re-draft and save the AI summary for every item in the group, one request per item. */
  async function rerunAllSummaries() {
    const total = assets.length;
    let failed = 0;
    setRerunFailed(null);
    setRerunDone(false);
    for (let index = 0; index < total; index += 1) {
      setRerunProgress({ done: index, total });
      try {
        await api.post(
          `/api/user/workspace-asset-groups/${groupId}/assets/${assets[index].id}/summarize`,
          { persistDescription: true },
        );
      } catch {
        failed += 1;
      }
    }
    setRerunProgress(null);
    await reloadGroup();
    if (failed > 0) setRerunFailed(failed);
    else setRerunDone(true);
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={assets.length === 0 || rerunRunning}
            onClick={() => setRerunOpen(true)}
          >
            Re-run summaries
          </Button>
          <Button type="button" size="sm" disabled={atCap} onClick={() => setAddOpen(true)}>
            Add asset
          </Button>
        </div>
      </div>

      {rerunRunning ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Summarizing {rerunProgress.done + 1}/{rerunProgress.total}…
        </p>
      ) : rerunFailed !== null ? (
        <p className="text-sm text-destructive">
          {rerunFailed} of {assets.length} summaries could not be generated.
        </p>
      ) : rerunDone ? (
        <p className="text-sm text-primary">Summaries updated.</p>
      ) : null}

      {assets.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing in this group yet. Click Add asset to upload a file or link a live doc.
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

      <AssetRerunSummariesDialog
        open={rerunOpen}
        onOpenChange={setRerunOpen}
        onConfirm={() => {
          setRerunOpen(false);
          void rerunAllSummaries();
        }}
      />
    </div>
  );
}

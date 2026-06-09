import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useClickToEditGroupName } from "@/hooks/useClickToEditGroupName";
import { api } from "@/lib/api";
import { ASSETS_MAX_PER_GROUP } from "@/lib/asset-groups-limits";
import type { AgentAssetRecord } from "@/types/repositories";
import { AssetGroupFilesBlock } from "@/pages/dashboard/components/asset-group-files-block";
import { AssetGroupNameFields } from "@/pages/dashboard/components/asset-group-name-fields";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import { GroupEditorCardNameHeader } from "@/pages/dashboard/components/group-editor-card-name-header";
import { PageLoader } from "@/components/ui/spinner";

export function AssetGroupEditor({ groupId, onSaved }: { groupId: string; onSaved: () => Promise<void> }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [assets, setAssets] = useState<AgentAssetRecord[]>([]);
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);

  const loadGroup = useCallback(async () => {
    const res = await api.get<{ group: { name: string; assets: AgentAssetRecord[] } }>(
      `/api/user/workspace-asset-groups/${groupId}`,
    );
    setGroupName(res.group.name);
    setBaselineName(res.group.name);
    setAssets([...res.group.assets].sort((a, b) => a.sort_order - b.sort_order));
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoading(true);
      setLoadError(null);
      try {
        await loadGroup();
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load group.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [groupId, loadGroup]);

  const nameDirty = useMemo(() => groupName.trim() !== baselineName.trim(), [baselineName, groupName]);
  const clearNameError = useCallback(() => setNameError(null), []);
  const { nameEditing, startNameEdit, endNameEdit } = useClickToEditGroupName(
    groupId,
    baselineName,
    setGroupName,
    clearNameError,
  );

  async function handleSaveGroupName() {
    setSavingGroupName(true);
    setNameError(null);
    try {
      await api.patch(`/api/user/workspace-asset-groups/${groupId}`, { name: groupName.trim() });
      setBaselineName(groupName.trim());
      endNameEdit();
      await onSaved();
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Could not save group name.");
    } finally {
      setSavingGroupName(false);
    }
  }

  async function handleConfirmDeleteGroup() {
    setDeletingGroup(true);
    try {
      await api.delete(`/api/user/workspace-asset-groups/${groupId}`);
      await onSaved();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Could not delete group.");
    } finally {
      setDeletingGroup(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <GroupEditorCardNameHeader
          icon={<FolderOpen className="size-5 shrink-0 text-primary" aria-hidden />}
          helpLabel="Workspace asset groups"
          helpContent={
            <p>
              Click the title to rename. Each file includes what it is about; the agent decides when to send on
              WhatsApp. Attach groups per agent on Profile.
            </p>
          }
          loading={loading}
          loadError={loadError}
          nameEditing={nameEditing}
          groupName={groupName}
          deletingGroup={deletingGroup}
          onStartNameEdit={startNameEdit}
          nameFields={
            <AssetGroupNameFields
              groupId={groupId}
              value={groupName}
              onChange={setGroupName}
              nameDirty={nameDirty}
              saving={savingGroupName}
              disabled={deletingGroup}
              error={nameError}
              onSave={() => void handleSaveGroupName()}
              className="min-w-0"
            />
          }
        />
        {!loading && !loadError ? (
          <CardDescription>
            {assets.length}/{ASSETS_MAX_PER_GROUP} files
          </CardDescription>
        ) : null}
        <CardAction className="-mt-0.5 shrink-0 sm:justify-self-end">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deletingGroup || loading || Boolean(loadError)}
            onClick={() => setDeleteGroupDialogOpen(true)}
          >
            Delete group
          </Button>
        </CardAction>
      </CardHeader>
      <ConfirmDestructiveDialog
        open={deleteGroupDialogOpen}
        onOpenChange={setDeleteGroupDialogOpen}
        title="Delete this group?"
        description="It removes all files and detaches from every agent."
        confirmLabel="Delete group"
        pendingConfirmLabel="Deleting…"
        isConfirming={deletingGroup}
        onConfirm={handleConfirmDeleteGroup}
      />
      <CardContent>
        {loading ? (
          <PageLoader layout="agentTabPanel" label="Loading group" />
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <AssetGroupFilesBlock
            groupId={groupId}
            assets={assets}
            reloadGroup={loadGroup}
            onWorkspaceStale={onSaved}
          />
        )}
      </CardContent>
    </Card>
  );
}

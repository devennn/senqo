import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useClickToEditGroupName } from "@/hooks/useClickToEditGroupName";
import { api } from "@/lib/api";
import type {
  WorkspaceButtonTemplateEntryRecord,
  WorkspaceButtonTemplateGroupWithEntries,
} from "@/types/repositories";
import { ButtonTemplateGroupEditorHeader } from "@/pages/dashboard/components/button-template-group-editor-header";
import { ButtonTemplateGroupTemplatesBlock } from "@/pages/dashboard/components/button-template-group-templates-block";
import { ConfirmDestructiveDialog } from "@/components/confirm-destructive-dialog";
import { PageLoader } from "@/components/ui/spinner";

export function ButtonTemplateGroupEditor({
  groupId,
  usedByNames = [],
  onSaved,
}: {
  groupId: string;
  usedByNames?: string[];
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkspaceButtonTemplateEntryRecord[]>([]);
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);

  const loadGroup = useCallback(async () => {
    const res = await api.get<{ group: WorkspaceButtonTemplateGroupWithEntries }>(
      `/api/user/button-template-groups/${groupId}`,
    );
    setGroupName(res.group.name);
    setBaselineName(res.group.name);
    setUpdatedAt(res.group.updated_at);
    const ordered = [...res.group.entries].sort((a, b) => a.sort_order - b.sort_order);
    setEntries(ordered);
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
      await api.patch(`/api/user/button-template-groups/${groupId}`, { name: groupName.trim() });
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
      await api.delete(`/api/user/button-template-groups/${groupId}`);
      await onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete group.";
      throw new Error(msg);
    } finally {
      setDeletingGroup(false);
    }
  }

  return (
    // overflow-visible keeps position:sticky working for the entry editors'
    // Save/Cancel bars (the Card primitive clips by default).
    <Card className="overflow-visible">
      <ButtonTemplateGroupEditorHeader
        groupId={groupId}
        loading={loading}
        loadError={loadError}
        nameEditing={nameEditing}
        groupName={groupName}
        deletingGroup={deletingGroup}
        onStartNameEdit={startNameEdit}
        onChangeName={setGroupName}
        nameDirty={nameDirty}
        savingName={savingGroupName}
        nameError={nameError}
        onSaveName={() => void handleSaveGroupName()}
        entryCount={entries.length}
        updatedAt={updatedAt}
        usedByNames={usedByNames}
        onRequestDelete={() => setDeleteGroupDialogOpen(true)}
      />
      <ConfirmDestructiveDialog
        open={deleteGroupDialogOpen}
        onOpenChange={setDeleteGroupDialogOpen}
        title="Delete this group?"
        description="It removes all button templates and detaches from every agent."
        confirmLabel="Delete group"
        pendingConfirmLabel="Deleting…"
        isConfirming={deletingGroup}
        onConfirm={handleConfirmDeleteGroup}
      />
      <CardContent className="space-y-6">
        {loading ? (
          <PageLoader layout="agentTabPanel" label="Loading group" />
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : (
          <ButtonTemplateGroupTemplatesBlock
            groupId={groupId}
            entries={entries}
            reloadGroup={loadGroup}
            onWorkspaceStale={onSaved}
          />
        )}
      </CardContent>
    </Card>
  );
}

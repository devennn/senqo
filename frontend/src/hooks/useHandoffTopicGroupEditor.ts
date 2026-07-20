import { useCallback, useEffect, useMemo, useState } from "react";
import { useClickToEditGroupName } from "@/hooks/useClickToEditGroupName";
import { api } from "@/lib/api";
import type {
  WorkspaceHandoffTopicEntryRecord,
  WorkspaceHandoffTopicGroupWithEntries,
} from "@/types/repositories";

export function useHandoffTopicGroupEditor(groupId: string, onSaved: () => Promise<void>) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [entries, setEntries] = useState<WorkspaceHandoffTopicEntryRecord[]>([]);
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);

  const loadGroup = useCallback(async () => {
    const res = await api.get<{ group: WorkspaceHandoffTopicGroupWithEntries }>(
      `/api/user/handoff-topic-groups/${groupId}`,
    );
    setGroupName(res.group.name);
    setBaselineName(res.group.name);
    setEntries([...res.group.entries].sort((a, b) => a.sort_order - b.sort_order));
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
      await api.patch(`/api/user/handoff-topic-groups/${groupId}`, { name: groupName.trim() });
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
      await api.delete(`/api/user/handoff-topic-groups/${groupId}`);
      await onSaved();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Could not delete group.");
    } finally {
      setDeletingGroup(false);
    }
  }

  return {
    loading,
    loadError,
    groupName,
    setGroupName,
    entries,
    nameDirty,
    nameEditing,
    startNameEdit,
    savingGroupName,
    nameError,
    deletingGroup,
    deleteGroupDialogOpen,
    setDeleteGroupDialogOpen,
    loadGroup,
    handleSaveGroupName,
    handleConfirmDeleteGroup,
  };
}

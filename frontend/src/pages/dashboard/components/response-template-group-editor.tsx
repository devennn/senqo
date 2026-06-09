import { useCallback, useEffect, useMemo, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClickToEditGroupName } from "@/hooks/useClickToEditGroupName";
import { api } from "@/lib/api";
import { RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP } from "@/lib/response-template-limits";
import type {
  WorkspaceResponseTemplateEntryRecord,
  WorkspaceResponseTemplateGroupWithEntries,
} from "@/types/repositories";
import { ResponseTemplateGroupNameFields } from "@/pages/dashboard/components/response-template-group-name-fields";
import { ResponseTemplateGroupTemplatesBlock } from "@/pages/dashboard/components/response-template-group-templates-block";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import { GroupEditorCardNameHeader } from "@/pages/dashboard/components/group-editor-card-name-header";
import { PageLoader } from "@/components/ui/spinner";

export function ResponseTemplateGroupEditor({ groupId, onSaved }: { groupId: string; onSaved: () => Promise<void> }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [entries, setEntries] = useState<WorkspaceResponseTemplateEntryRecord[]>([]);
  const [savingGroupName, setSavingGroupName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);

  const loadGroup = useCallback(async () => {
    const res = await api.get<{ group: WorkspaceResponseTemplateGroupWithEntries }>(
      `/api/user/response-template-groups/${groupId}`,
    );
    setGroupName(res.group.name);
    setBaselineName(res.group.name);
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
  const { nameEditing, startNameEdit, endNameEdit } = useClickToEditGroupName(groupId, baselineName, setGroupName, clearNameError);

  async function handleSaveGroupName() {
    setSavingGroupName(true);
    setNameError(null);
    try {
      await api.patch(`/api/user/response-template-groups/${groupId}`, { name: groupName.trim() });
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
      await api.delete(`/api/user/response-template-groups/${groupId}`);
      await onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete group.";
      throw new Error(msg);
    } finally {
      setDeletingGroup(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <GroupEditorCardNameHeader
          icon={<MessagesSquare className="size-5 shrink-0 text-primary" aria-hidden />}
          helpLabel="Template groups overview"
          helpContent={
            <p>
              Click the title to rename. Press Escape while editing to cancel. Store predefined WhatsApp replies as entries
              (shopper intent + exact answer). Attach this group per agent on Profile. Add or edit entries one at a time.
            </p>
          }
          loading={loading}
          loadError={loadError}
          nameEditing={nameEditing}
          groupName={groupName}
          deletingGroup={deletingGroup}
          onStartNameEdit={startNameEdit}
          nameFields={
            <ResponseTemplateGroupNameFields
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
            {entries.length}/{RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP} entries
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
        description="It removes all templates and detaches from every agent."
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
          <ResponseTemplateGroupTemplatesBlock groupId={groupId} entries={entries} reloadGroup={loadGroup} onWorkspaceStale={onSaved} />
        )}
      </CardContent>
    </Card>
  );
}

import { Users } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHandoffTopicGroupEditor } from "@/hooks/useHandoffTopicGroupEditor";
import { HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP } from "@/lib/agent-handoff-topic-limits";
import { HandoffTopicGroupEditorContent } from "@/pages/dashboard/components/handoff-topic-group-editor-content";
import { HandoffTopicGroupNameFields } from "@/pages/dashboard/components/handoff-topic-group-name-fields";
import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";
import { GroupEditorCardNameHeader } from "@/pages/dashboard/components/group-editor-card-name-header";
import { PageLoader } from "@/components/ui/spinner";

type Props = {
  groupId: string;
  onSaved: () => Promise<void>;
  onOpenAttachDialog: () => void;
};

export function HandoffTopicGroupEditor({ groupId, onSaved, onOpenAttachDialog }: Props) {
  const editor = useHandoffTopicGroupEditor(groupId, onSaved);
  const actionsDisabled = editor.deletingGroup || editor.loading || Boolean(editor.loadError);

  return (
    <Card>
      <CardHeader>
        <GroupEditorCardNameHeader
          icon={<Users className="size-5 shrink-0 text-primary" aria-hidden />}
          helpLabel="Handoff groups overview"
          helpContent={
            <p>
              Click the title to rename. Press Escape while editing to cancel. Define topics that should trigger a human
              takeover. Edit one topic row at a time. Use Handoff settings to choose agents and who to notify.
            </p>
          }
          loading={editor.loading}
          loadError={editor.loadError}
          nameEditing={editor.nameEditing}
          groupName={editor.groupName}
          deletingGroup={editor.deletingGroup}
          onStartNameEdit={editor.startNameEdit}
          nameFields={
            <HandoffTopicGroupNameFields
              groupId={groupId}
              value={editor.groupName}
              onChange={editor.setGroupName}
              nameDirty={editor.nameDirty}
              saving={editor.savingGroupName}
              disabled={editor.deletingGroup}
              error={editor.nameError}
              onSave={() => void editor.handleSaveGroupName()}
              className="min-w-0"
            />
          }
        />
        {!editor.loading && !editor.loadError ? (
          <CardDescription>
            {editor.entries.length}/{HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP} topics
          </CardDescription>
        ) : null}
        <CardAction className="-mt-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-self-end">
          <Button type="button" variant="outline" size="sm" disabled={actionsDisabled} onClick={onOpenAttachDialog}>
            Handoff settings
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={actionsDisabled}
            onClick={() => editor.setDeleteGroupDialogOpen(true)}
          >
            Delete group
          </Button>
        </CardAction>
      </CardHeader>
      <ConfirmDestructiveDialog
        open={editor.deleteGroupDialogOpen}
        onOpenChange={editor.setDeleteGroupDialogOpen}
        title="Delete this group?"
        description="It removes all topics and detaches from every agent."
        confirmLabel="Delete group"
        pendingConfirmLabel="Deleting…"
        isConfirming={editor.deletingGroup}
        onConfirm={editor.handleConfirmDeleteGroup}
      />
      <CardContent className="space-y-6">
        {editor.loading ? (
          <PageLoader layout="agentTabPanel" label="Loading group" />
        ) : editor.loadError ? (
          <p className="text-sm text-destructive">{editor.loadError}</p>
        ) : (
          <HandoffTopicGroupEditorContent
            groupId={groupId}
            entries={editor.entries}
            reloadGroup={editor.loadGroup}
            onWorkspaceStale={onSaved}
          />
        )}
      </CardContent>
    </Card>
  );
}

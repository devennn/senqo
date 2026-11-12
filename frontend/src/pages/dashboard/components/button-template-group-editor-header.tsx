import { MousePointerClick } from "lucide-react";
import { CardAction, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP } from "@/lib/button-template-limits";
import { ButtonTemplateGroupNameFields } from "@/pages/dashboard/components/button-template-group-name-fields";
import { GroupEditorCardNameHeader } from "@/pages/dashboard/components/group-editor-card-name-header";
import { KnowledgeUpdatedAtLine } from "@/pages/dashboard/components/knowledge-updated-at-line";

type Props = {
  groupId: string;
  loading: boolean;
  loadError: string | null;
  nameEditing: boolean;
  groupName: string;
  deletingGroup: boolean;
  onStartNameEdit: () => void;
  onChangeName: (next: string) => void;
  nameDirty: boolean;
  savingName: boolean;
  nameError: string | null;
  onSaveName: () => void;
  entryCount: number;
  updatedAt: string | null;
  usedByNames: string[];
  onRequestDelete: () => void;
};

export function ButtonTemplateGroupEditorHeader({
  groupId,
  loading,
  loadError,
  nameEditing,
  groupName,
  deletingGroup,
  onStartNameEdit,
  onChangeName,
  nameDirty,
  savingName,
  nameError,
  onSaveName,
  entryCount,
  updatedAt,
  usedByNames,
  onRequestDelete,
}: Props) {
  return (
    <CardHeader>
      <GroupEditorCardNameHeader
        icon={<MousePointerClick className="size-5 shrink-0 text-primary" aria-hidden />}
        helpLabel="Button groups overview"
        helpContent={
          <p>
            Click the title to rename. Press Escape while editing to cancel. Each template is a message plus
            up to three interactive buttons. Attach this group per agent on Profile.
          </p>
        }
        loading={loading}
        loadError={loadError}
        nameEditing={nameEditing}
        groupName={groupName}
        deletingGroup={deletingGroup}
        onStartNameEdit={onStartNameEdit}
        nameFields={
          <ButtonTemplateGroupNameFields
            groupId={groupId}
            value={groupName}
            onChange={onChangeName}
            nameDirty={nameDirty}
            saving={savingName}
            disabled={deletingGroup}
            error={nameError}
            onSave={onSaveName}
            className="min-w-0"
          />
        }
      />
      {!loading && !loadError ? (
        <CardDescription>
          <KnowledgeUpdatedAtLine
            entryCount={entryCount}
            entryMax={BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP}
            entryLabelSingular="template"
            entryLabelPlural="templates"
            updatedAt={updatedAt}
            usedByNames={usedByNames}
          />
        </CardDescription>
      ) : null}
      <CardAction className="-mt-0.5 shrink-0 sm:justify-self-end">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={deletingGroup || loading || Boolean(loadError)}
          onClick={onRequestDelete}
        >
          Delete group
        </Button>
      </CardAction>
    </CardHeader>
  );
}

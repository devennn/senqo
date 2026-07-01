import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  effectiveTemplateEntryDisposition,
  effectiveTemplateGroupDisposition,
  isImportReviewItemVisible,
  isImportReviewTemplateGroupVisible,
} from "@/lib/agent-knowledge-import-selection";
import {
  AgentKnowledgeImportDispositionActions,
  AgentKnowledgeImportItemHeader,
  showNestedImportDispositionControls,
} from "@/pages/dashboard/components/agent-knowledge-import-disposition-actions";
import { AgentKnowledgeImportGroupShell } from "@/pages/dashboard/components/agent-knowledge-import-group-shell";
import { AgentKnowledgeImportReviewAnimatedItem } from "@/pages/dashboard/components/agent-knowledge-import-review-animated-item";
import type { AgentKnowledgeImportDraft, DraftTemplateGroup } from "@/types/agent-knowledge-import";
import type {
  AgentKnowledgeImportApplyTarget,
  AgentKnowledgeImportSelection,
} from "@/types/agent-knowledge-import-selection";

type Props = {
  draft: AgentKnowledgeImportDraft;
  groups: DraftTemplateGroup[];
  selection: AgentKnowledgeImportSelection;
  applyingTarget: AgentKnowledgeImportApplyTarget | null;
  onChange: (groups: DraftTemplateGroup[]) => void;
  onAddGroup: (groupId: string) => void;
  onAddEntry: (groupId: string, entryId: string) => void;
  onDiscardGroup: (groupId: string) => void;
  onDiscardEntry: (groupId: string, entryId: string) => void;
};

export function AgentKnowledgeImportDraftTemplates({
  draft,
  groups,
  selection,
  applyingTarget,
  onChange,
  onAddGroup,
  onAddEntry,
  onDiscardGroup,
  onDiscardEntry,
}: Props) {
  if (groups.length === 0) return null;

  function updateGroup(groupId: string, patch: Partial<DraftTemplateGroup>) {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  }

  function updateEntry(
    groupId: string,
    entryId: string,
    patch: { questionText?: string; answerText?: string },
  ) {
    onChange(
      groups.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, entries: g.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) },
      ),
    );
  }

  function isEntryApplying(groupId: string, entryId: string): boolean {
    return (
      applyingTarget?.kind === "template-entry" &&
      applyingTarget.groupId === groupId &&
      applyingTarget.entryId === entryId
    );
  }

  return (
    <section className="space-y-4">
      {groups.map((group) => {
        const groupDisposition = effectiveTemplateGroupDisposition(draft, selection, group.id);
        const isAddingGroup =
          applyingTarget?.kind === "template-group" && applyingTarget.groupId === group.id;
        const showEntryControls = showNestedImportDispositionControls(groupDisposition);
        const groupVisible = isImportReviewTemplateGroupVisible(
          draft,
          selection,
          group.id,
          applyingTarget,
        );

        return (
          <AgentKnowledgeImportReviewAnimatedItem key={group.id} visible={groupVisible}>
            <AgentKnowledgeImportGroupShell
              kindLabel="Template group"
              name={group.name}
              nameInputId={`tpl-group-${group.id}`}
              onNameChange={(next) => updateGroup(group.id, { name: next })}
              actions={
                <AgentKnowledgeImportDispositionActions
                  applying={isAddingGroup}
                  onAccept={() => onAddGroup(group.id)}
                  onDiscard={() => onDiscardGroup(group.id)}
                />
              }
            >
              {group.entries.map((entry, index) => {
                const entryVisible = isImportReviewItemVisible(
                  effectiveTemplateEntryDisposition(selection, group.id, entry.id),
                  isEntryApplying(group.id, entry.id),
                );

                return (
                  <AgentKnowledgeImportReviewAnimatedItem key={entry.id} visible={entryVisible}>
                    <div
                      className={cn(
                        "space-y-3",
                        index > 0 ? "border-t border-border/60 pt-3" : undefined,
                      )}
                    >
                      {showEntryControls ? (
                        <AgentKnowledgeImportItemHeader
                          label={`Entry ${index + 1}`}
                          actions={
                            <AgentKnowledgeImportDispositionActions
                              applying={isEntryApplying(group.id, entry.id)}
                              onAccept={() => onAddEntry(group.id, entry.id)}
                              onDiscard={() => onDiscardEntry(group.id, entry.id)}
                            />
                          }
                        />
                      ) : (
                        <p className="text-sm font-medium text-foreground">Entry {index + 1}</p>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor={`tpl-q-${entry.id}`}>Customer intent</Label>
                        <Input
                          id={`tpl-q-${entry.id}`}
                          value={entry.questionText}
                          onChange={(e) => updateEntry(group.id, entry.id, { questionText: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tpl-a-${entry.id}`}>Verbatim reply</Label>
                        <Textarea
                          id={`tpl-a-${entry.id}`}
                          value={entry.answerText}
                          onChange={(e) => updateEntry(group.id, entry.id, { answerText: e.target.value })}
                          rows={3}
                          className="resize-y"
                        />
                      </div>
                    </div>
                  </AgentKnowledgeImportReviewAnimatedItem>
                );
              })}
            </AgentKnowledgeImportGroupShell>
          </AgentKnowledgeImportReviewAnimatedItem>
        );
      })}
    </section>
  );
}

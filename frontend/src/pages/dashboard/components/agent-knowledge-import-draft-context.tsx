import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  effectiveContextFactDisposition,
  effectiveContextGroupDisposition,
  isImportReviewContextGroupVisible,
  isImportReviewItemVisible,
} from "@/lib/agent-knowledge-import-selection";
import {
  AgentKnowledgeImportDispositionActions,
  AgentKnowledgeImportItemHeader,
  showNestedImportDispositionControls,
} from "@/pages/dashboard/components/agent-knowledge-import-disposition-actions";
import { AgentKnowledgeImportGroupShell } from "@/pages/dashboard/components/agent-knowledge-import-group-shell";
import { AgentKnowledgeImportReviewAnimatedItem } from "@/pages/dashboard/components/agent-knowledge-import-review-animated-item";
import type { AgentKnowledgeImportDraft, DraftContextGroup } from "@/types/agent-knowledge-import";
import type {
  AgentKnowledgeImportApplyTarget,
  AgentKnowledgeImportSelection,
} from "@/types/agent-knowledge-import-selection";

type Props = {
  draft: AgentKnowledgeImportDraft;
  groups: DraftContextGroup[];
  selection: AgentKnowledgeImportSelection;
  applyingTarget: AgentKnowledgeImportApplyTarget | null;
  onChange: (groups: DraftContextGroup[]) => void;
  onAddGroup: (groupId: string) => void;
  onAddFact: (groupId: string, factId: string) => void;
  onDiscardGroup: (groupId: string) => void;
  onDiscardFact: (groupId: string, factId: string) => void;
};

export function AgentKnowledgeImportDraftContext({
  draft,
  groups,
  selection,
  applyingTarget,
  onChange,
  onAddGroup,
  onAddFact,
  onDiscardGroup,
  onDiscardFact,
}: Props) {
  if (groups.length === 0) return null;

  function updateGroup(groupId: string, patch: Partial<DraftContextGroup>) {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  }

  function updateFact(groupId: string, factId: string, patch: { title?: string; bodyText?: string }) {
    onChange(
      groups.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, facts: g.facts.map((f) => (f.id === factId ? { ...f, ...patch } : f)) },
      ),
    );
  }

  function isFactApplying(groupId: string, factId: string): boolean {
    return (
      applyingTarget?.kind === "context-fact" &&
      applyingTarget.groupId === groupId &&
      applyingTarget.factId === factId
    );
  }

  return (
    <section className="space-y-4">
      {groups.map((group) => {
        const groupDisposition = effectiveContextGroupDisposition(draft, selection, group.id);
        const isAddingGroup =
          applyingTarget?.kind === "context-group" && applyingTarget.groupId === group.id;
        const showFactControls = showNestedImportDispositionControls(groupDisposition);
        const groupVisible = isImportReviewContextGroupVisible(
          draft,
          selection,
          group.id,
          applyingTarget,
        );

        return (
          <AgentKnowledgeImportReviewAnimatedItem key={group.id} visible={groupVisible}>
            <AgentKnowledgeImportGroupShell
              kindLabel="Context group"
              name={group.name}
              nameInputId={`ctx-group-${group.id}`}
              onNameChange={(next) => updateGroup(group.id, { name: next })}
              actions={
                <AgentKnowledgeImportDispositionActions
                  applying={isAddingGroup}
                  onAccept={() => onAddGroup(group.id)}
                  onDiscard={() => onDiscardGroup(group.id)}
                />
              }
            >
              {group.facts.map((fact, index) => {
                const factVisible = isImportReviewItemVisible(
                  effectiveContextFactDisposition(selection, group.id, fact.id),
                  isFactApplying(group.id, fact.id),
                );

                return (
                  <AgentKnowledgeImportReviewAnimatedItem key={fact.id} visible={factVisible}>
                    <div
                      className={cn(
                        "space-y-3",
                        index > 0 ? "border-t border-border/60 pt-3" : undefined,
                      )}
                    >
                      {showFactControls ? (
                        <AgentKnowledgeImportItemHeader
                          label={`Fact ${index + 1}`}
                          actions={
                            <AgentKnowledgeImportDispositionActions
                              applying={isFactApplying(group.id, fact.id)}
                              onAccept={() => onAddFact(group.id, fact.id)}
                              onDiscard={() => onDiscardFact(group.id, fact.id)}
                            />
                          }
                        />
                      ) : (
                        <p className="text-sm font-medium text-foreground">Fact {index + 1}</p>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor={`ctx-fact-title-${fact.id}`}>Title</Label>
                        <Input
                          id={`ctx-fact-title-${fact.id}`}
                          value={fact.title}
                          onChange={(e) => updateFact(group.id, fact.id, { title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`ctx-fact-body-${fact.id}`}>Body</Label>
                        <Textarea
                          id={`ctx-fact-body-${fact.id}`}
                          value={fact.bodyText}
                          onChange={(e) => updateFact(group.id, fact.id, { bodyText: e.target.value })}
                          rows={4}
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

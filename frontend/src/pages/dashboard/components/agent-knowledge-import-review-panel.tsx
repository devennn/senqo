import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { countVisibleImportReviewItems } from "@/lib/agent-knowledge-import-selection";
import { AgentKnowledgeImportReviewTabs } from "@/pages/dashboard/components/agent-knowledge-import-review-tabs";
import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";
import type {
  AgentKnowledgeImportApplyTarget,
  AgentKnowledgeImportSelection,
} from "@/types/agent-knowledge-import-selection";

type ReviewBodyProps = {
  draft: AgentKnowledgeImportDraft;
  selection: AgentKnowledgeImportSelection;
  applyingTarget: AgentKnowledgeImportApplyTarget | null;
  profileName: string;
  onDraftChange: (draft: AgentKnowledgeImportDraft) => void;
  onAddContextGroup: (groupId: string) => void;
  onDiscardContextGroup: (groupId: string) => void;
  onAddContextFact: (groupId: string, factId: string) => void;
  onDiscardContextFact: (groupId: string, factId: string) => void;
  onAddSkill: (skillId: string) => void;
  onDiscardSkill: (skillId: string) => void;
  onAddTemplateGroup: (groupId: string) => void;
  onDiscardTemplateGroup: (groupId: string) => void;
  onAddTemplateEntry: (groupId: string, entryId: string) => void;
  onDiscardTemplateEntry: (groupId: string, entryId: string) => void;
};

export function AgentKnowledgeImportReviewBody({
  draft,
  selection,
  applyingTarget,
  profileName,
  onDraftChange,
  onAddContextGroup,
  onDiscardContextGroup,
  onAddContextFact,
  onDiscardContextFact,
  onAddSkill,
  onDiscardSkill,
  onAddTemplateGroup,
  onDiscardTemplateGroup,
  onAddTemplateEntry,
  onDiscardTemplateEntry,
}: ReviewBodyProps) {
  const visibleCounts = countVisibleImportReviewItems(draft, selection, applyingTarget);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>Review generated items</span>
          <InlineHelpHint label="Review before saving">
            <p>
              Use the check to add an item to {profileName} right away, or X to skip it. Add all saves
              everything still listed.
            </p>
          </InlineHelpHint>
        </CardTitle>
        <CardDescription>
          {visibleCounts.contextFacts} context facts · {visibleCounts.skills} skills ·{" "}
          {visibleCounts.templateEntries} template entries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AgentKnowledgeImportReviewTabs
          draft={draft}
          selection={selection}
          applyingTarget={applyingTarget}
          onDraftChange={onDraftChange}
          onAddContextGroup={onAddContextGroup}
          onDiscardContextGroup={onDiscardContextGroup}
          onAddContextFact={onAddContextFact}
          onDiscardContextFact={onDiscardContextFact}
          onAddSkill={onAddSkill}
          onDiscardSkill={onDiscardSkill}
          onAddTemplateGroup={onAddTemplateGroup}
          onDiscardTemplateGroup={onDiscardTemplateGroup}
          onAddTemplateEntry={onAddTemplateEntry}
          onDiscardTemplateEntry={onDiscardTemplateEntry}
        />
      </CardContent>
    </Card>
  );
}

type ReviewFooterProps = {
  pendingCount: number;
  applyError: string | null;
  applyingTarget: AgentKnowledgeImportApplyTarget | null;
  onBack: () => void;
  onApplyAllPending: () => Promise<void>;
};

export function AgentKnowledgeImportReviewFooter({
  pendingCount,
  applyError,
  applyingTarget,
  onBack,
  onApplyAllPending,
}: ReviewFooterProps) {
  const [applyingAll, setApplyingAll] = useState(false);
  const isBusy = applyingAll || applyingTarget !== null;

  async function handleApplyAll() {
    setApplyingAll(true);
    try {
      await onApplyAllPending();
    } catch {
      // applyError is set in the hook
    } finally {
      setApplyingAll(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-card px-6 py-4">
      {applyError ? <p className="mb-3 text-sm text-destructive">{applyError}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={isBusy}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => {
            void handleApplyAll();
          }}
          disabled={isBusy || pendingCount === 0}
        >
          {applyingAll ? "Adding…" : "Add all"}
        </Button>
      </div>
    </div>
  );
}

export function AgentKnowledgeImportAppliedBanner({
  profileName,
  onStartOver,
  onClose,
}: {
  profileName: string;
  onStartOver: () => void;
  onClose?: () => void;
}) {
  return (
    <Card className="border-primary/30 bg-secondary/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="size-5 text-primary" aria-hidden />
          Import saved
        </CardTitle>
        <CardDescription>
          Accepted items were created and attached to {profileName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onStartOver}>
          Import more docs
        </Button>
        {onClose ? (
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { countVisibleImportReviewItems } from "@/lib/agent-knowledge-import-selection";
import {
  AgentKnowledgeImportDraftContext,
  AgentKnowledgeImportDraftSkills,
  AgentKnowledgeImportDraftTemplates,
} from "@/pages/dashboard/components/agent-knowledge-import-draft-sections";
import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";
import type {
  AgentKnowledgeImportApplyTarget,
  AgentKnowledgeImportSelection,
} from "@/types/agent-knowledge-import-selection";

type ReviewTabId = "context" | "skills" | "templates";

type TabDef = {
  id: ReviewTabId;
  label: string;
};

type Props = {
  draft: AgentKnowledgeImportDraft;
  selection: AgentKnowledgeImportSelection;
  applyingTarget: AgentKnowledgeImportApplyTarget | null;
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

function firstAvailableTab(tabs: TabDef[]): ReviewTabId {
  return tabs[0]?.id ?? "context";
}

export function AgentKnowledgeImportReviewTabs({
  draft,
  selection,
  applyingTarget,
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
}: Props) {
  const visibleCounts = useMemo(
    () => countVisibleImportReviewItems(draft, selection, applyingTarget),
    [applyingTarget, draft, selection],
  );

  const tabs = useMemo<TabDef[]>(() => {
    const next: TabDef[] = [];
    if (visibleCounts.contextFacts > 0) {
      next.push({
        id: "context",
        label:
          visibleCounts.contextFacts === 1
            ? "Context (1 fact)"
            : `Context (${visibleCounts.contextFacts} facts)`,
      });
    }
    if (visibleCounts.skills > 0) {
      next.push({
        id: "skills",
        label: visibleCounts.skills === 1 ? "Skills (1)" : `Skills (${visibleCounts.skills})`,
      });
    }
    if (visibleCounts.templateEntries > 0) {
      next.push({
        id: "templates",
        label:
          visibleCounts.templateEntries === 1
            ? "Templates (1 entry)"
            : `Templates (${visibleCounts.templateEntries} entries)`,
      });
    }
    return next;
  }, [visibleCounts.contextFacts, visibleCounts.skills, visibleCounts.templateEntries]);

  const [activeTab, setActiveTab] = useState<ReviewTabId>(() => firstAvailableTab(tabs));
  const selectedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : firstAvailableTab(tabs);

  if (tabs.length === 0) {
    return <p className="text-sm text-muted-foreground">No items left to review.</p>;
  }

  return (
    <div className="space-y-4">
      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Generated import sections"
          className="flex w-full gap-1 border-b border-border sm:gap-2"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`import-review-tab-${tab.id}`}
              aria-selected={selectedTab === tab.id}
              aria-controls={`import-review-panel-${tab.id}`}
              tabIndex={selectedTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative -mb-px min-h-10 flex-1 rounded-none border-b-2 bg-transparent px-3 py-2.5 text-sm outline-none transition-[color,border-color] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:flex-none sm:px-4",
                selectedTab === tab.id
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : tabs.length === 1 ? (
        <p className="text-sm font-semibold text-foreground">{tabs[0].label}</p>
      ) : null}

      {selectedTab === "context" ? (
        <div
          role="tabpanel"
          id="import-review-panel-context"
          aria-labelledby="import-review-tab-context"
          className="space-y-4"
        >
          <AgentKnowledgeImportDraftContext
            draft={draft}
            groups={draft.contextGroups}
            selection={selection}
            applyingTarget={applyingTarget}
            onChange={(contextGroups) => onDraftChange({ ...draft, contextGroups })}
            onAddGroup={onAddContextGroup}
            onDiscardGroup={onDiscardContextGroup}
            onAddFact={onAddContextFact}
            onDiscardFact={onDiscardContextFact}
          />
        </div>
      ) : null}

      {selectedTab === "skills" ? (
        <div
          role="tabpanel"
          id="import-review-panel-skills"
          aria-labelledby="import-review-tab-skills"
          className="space-y-4"
        >
          <AgentKnowledgeImportDraftSkills
            skills={draft.skills}
            selection={selection}
            applyingTarget={applyingTarget}
            onChange={(skills) => onDraftChange({ ...draft, skills })}
            onAddSkill={onAddSkill}
            onDiscardSkill={onDiscardSkill}
          />
        </div>
      ) : null}

      {selectedTab === "templates" ? (
        <div
          role="tabpanel"
          id="import-review-panel-templates"
          aria-labelledby="import-review-tab-templates"
          className="space-y-4"
        >
          <AgentKnowledgeImportDraftTemplates
            draft={draft}
            groups={draft.templateGroups}
            selection={selection}
            applyingTarget={applyingTarget}
            onChange={(templateGroups) => onDraftChange({ ...draft, templateGroups })}
            onAddGroup={onAddTemplateGroup}
            onDiscardGroup={onDiscardTemplateGroup}
            onAddEntry={onAddTemplateEntry}
            onDiscardEntry={onDiscardTemplateEntry}
          />
        </div>
      ) : null}
    </div>
  );
}

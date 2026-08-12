import { useSearchParams } from "react-router-dom";
import { useKnowledge } from "@/hooks/useKnowledge";
import { AppFrame } from "@/components/layout/app-frame";
import { PageLoader } from "@/components/ui/spinner";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import {
  KnowledgeTabBar,
  type KnowledgeTab,
} from "@/pages/dashboard/components/knowledge-tab-bar";
import { KnowledgeImportDocsButton } from "@/pages/dashboard/components/knowledge-import-docs-button";
import { ContextGroupsPanel } from "@/pages/dashboard/components/context-groups-panel";
import { ResponseTemplatesPanel } from "@/pages/dashboard/components/response-templates-panel";
import { HandoffTopicGroupsPanel } from "@/pages/dashboard/components/handoff-topic-groups-panel";

function parseKnowledgeTab(tabParam: string | null): KnowledgeTab {
  if (tabParam === "templates") return "templates";
  if (tabParam === "handoff") return "handoff";
  return "context";
}

export default function KnowledgePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, reload } = useKnowledge();
  const tab = parseKnowledgeTab(searchParams.get("tab"));

  function handleTabChange(next: KnowledgeTab) {
    const p = new URLSearchParams(searchParams);
    if (next === "context") {
      p.delete("tab");
    } else {
      p.set("tab", next);
    }
    if (next !== "templates") {
      p.delete("template");
      p.delete("templateGroupId");
    }
    if (next !== "handoff") {
      p.delete("handoffGroupId");
      p.delete("handoffEntryId");
      p.delete("handoff");
    }
    if (next !== "context") {
      p.delete("contextGroupId");
      p.delete("context");
    }
    setSearchParams(p, { replace: true });
  }

  return (
    <AppFrame
      conversations={[]}
      messages={[]}
      hideConversationRail
      mainPanel={
        loading ? (
          <PageLoader label="Loading knowledge" />
        ) : (
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">Knowledge</h1>
                  <InlineHelpHint label="About knowledge">
                    <p>
                      Workspace facts, reply templates, and handoff topics. Attach groups to an agent on Agent →
                      Profile → Attached knowledge. Groups older than 90 days show a may-be-outdated hint.
                    </p>
                  </InlineHelpHint>
                </div>
                <p className="mt-1.5 text-base text-muted-foreground">
                  Author workspace knowledge agents can use.
                </p>
              </div>
              <div className="sm:shrink-0">
                <KnowledgeImportDocsButton
                  agents={data.agents}
                  onApplied={() => void reload({ silent: true })}
                />
              </div>
            </div>
            <KnowledgeTabBar value={tab} onChange={handleTabChange} />
            {tab === "templates" ? (
              <div className="mt-6">
                <ResponseTemplatesPanel
                  groups={data.responseTemplateGroups}
                  agents={data.agents}
                  reload={reload}
                  agentId={undefined}
                />
              </div>
            ) : tab === "handoff" ? (
              <div className="mt-6">
                <HandoffTopicGroupsPanel
                  groups={data.handoffTopicGroups}
                  reload={reload}
                  agentId={undefined}
                  agents={data.agents}
                />
              </div>
            ) : (
              <div className="mt-6">
                <ContextGroupsPanel
                  groups={data.workspaceContextGroups}
                  agents={data.agents}
                  reload={reload}
                  agentId={undefined}
                />
              </div>
            )}
          </section>
        )
      }
    />
  );
}

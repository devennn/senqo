import { useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAgents } from "@/hooks/useAgents";
import { useWorkspace } from "@/context/workspace";
import type { SkillsNavConfig } from "@/hooks/useSkills";
import { AppFrame } from "@/components/layout/app-frame";
import { AgentList } from "@/pages/dashboard/components/agent-list";
import { AgentConfigForm } from "@/pages/dashboard/components/agent-config-form";
import { CreateAgentDialog } from "@/pages/dashboard/components/create-agent-dialog";
import { AgentSetupTabBar, type AgentSetupTab } from "@/pages/dashboard/components/agent-setup-tab-bar";
import { SkillsCatalogPanel } from "@/pages/dashboard/skills/components/skills-catalog-panel";
import { ResponseTemplatesPanel } from "@/pages/dashboard/components/response-templates-panel";
import { HandoffTopicGroupsPanel } from "@/pages/dashboard/components/handoff-topic-groups-panel";
import { ContextGroupsPanel } from "@/pages/dashboard/components/context-groups-panel";
import { AssetGroupsPanel } from "@/pages/dashboard/components/asset-groups-panel";
import { PageLoader } from "@/components/ui/spinner";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";

function AgentErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  const known: Record<string, string> = {
    whatsapp_detach_required: "Detach this agent from WhatsApp on the Connect page before archiving it.",
    cannot_archive_used: "This agent has already been used in conversations and cannot be archived.",
    cannot_delete_used: "This agent has already been used. Archive it to remove it from the UI.",
    agent_not_found: "That agent could not be found. Refresh and try again.",
  };
  return (
    <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {known[error] ?? decodeURIComponent(error)}
    </p>
  );
}

function AgentSuccessBanner({ success }: { success: string | null }) {
  if (!success) return null;
  const msgs: Record<string, string> = {
    agent_archived: "Agent archived and removed from the list.",
    agent_created: "Agent created.",
    agent_saved: "Agent saved.",
  };
  return (
    <p className="mt-4 rounded-md border border-primary/40 bg-secondary px-3 py-2 text-sm text-secondary-foreground">
      {msgs[success] ?? decodeURIComponent(success)}
    </p>
  );
}

export default function AgentPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { workspaceId, wsPath } = useWorkspace();
  const { data, loading, reload, createAgent, renameAgent, archiveAgent } = useAgents();
  const selectedId = searchParams.get("agentId") ?? data.agents[0]?.id;
  const selectedAgent = data.agents.find((a) => a.id === selectedId) ?? data.agents[0] ?? null;
  const agentConnectionOptions = useMemo(
    () =>
      data.connections.map((c) => ({
        id: c.id,
        displayName: c.display_name,
        phoneNumber: c.phone_number,
        attachedAgentId: c.agent_config_id ?? null,
      })),
    [data.connections],
  );
  const error = searchParams.get("error");
  const success = searchParams.get("success");
  const tabParam = searchParams.get("tab");
  const tab: AgentSetupTab =
    tabParam === "skills"
      ? "skills"
      : tabParam === "templates"
        ? "templates"
        : tabParam === "handoff"
          ? "handoff"
          : tabParam === "context"
            ? "context"
            : tabParam === "assets"
              ? "assets"
              : "profile";

  useEffect(() => {
    if (!success) return;
    const timerId = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("success");
          return next;
        },
        { replace: true },
      );
    }, TRANSIENT_SUCCESS_FEEDBACK_MS);
    return () => window.clearTimeout(timerId);
  }, [success, setSearchParams]);

  useEffect(() => {
    const legacyEditGroupId = searchParams.get("editGroup");
    if (tab !== "templates" || !legacyEditGroupId) return;
    const p = new URLSearchParams(searchParams);
    p.delete("editGroup");
    p.set("tab", "templates");
    p.set("templateGroupId", legacyEditGroupId);
    setSearchParams(p, { replace: true });
  }, [searchParams, setSearchParams, tab]);

  const skillsNavigation = useMemo<SkillsNavConfig>(() => {
    const fixedSearchParams: Record<string, string> = { tab: "skills" };
    if (selectedId) fixedSearchParams.agentId = selectedId;
    return { path: `/${workspaceId}/agent`, fixedSearchParams };
  }, [selectedId, workspaceId]);

  function handleTabChange(next: AgentSetupTab) {
    const p = new URLSearchParams(searchParams);
    if (next === "profile") {
      p.delete("tab");
    } else {
      p.set("tab", next);
    }
    if (next !== "templates") {
      p.delete("editGroup");
      p.delete("template");
      p.delete("templateGroupId");
    }
    if (next !== "handoff") {
      p.delete("handoffGroupId");
      p.delete("handoff");
    }
    if (next !== "context") {
      p.delete("contextGroupId");
      p.delete("context");
    }
    if (next !== "assets") {
      p.delete("assetGroupId");
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
          <PageLoader label="Loading agents" />
        ) : (
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Agent setup</h1>
                <p className="mt-1.5 text-base text-muted-foreground">
                  Configure agents (profile), workspace context, skills, templates, handoff topics, sendable assets, and tools per agent.
                </p>
              </div>
              <div className="sm:shrink-0">
                <CreateAgentDialog createAgent={createAgent} />
              </div>
            </div>
            <AgentSetupTabBar value={tab} onChange={handleTabChange} />
            <AgentErrorBanner error={error} />
            <AgentSuccessBanner success={success} />
            {tab === "skills" ? (
              <div className="mt-6">
                <SkillsCatalogPanel navigation={skillsNavigation} />
              </div>
            ) : tab === "context" ? (
              <div className="mt-6">
                <ContextGroupsPanel
                  groups={data.workspaceContextGroups}
                  reload={reload}
                  agentId={selectedId ?? undefined}
                />
              </div>
            ) : tab === "handoff" ? (
              <div className="mt-6">
                <HandoffTopicGroupsPanel
                  groups={data.handoffTopicGroups}
                  reload={reload}
                  agentId={selectedId ?? undefined}
                />
              </div>
            ) : tab === "templates" ? (
              <div className="mt-6">
                <ResponseTemplatesPanel
                  groups={data.responseTemplateGroups}
                  reload={reload}
                  agentId={selectedId ?? undefined}
                />
              </div>
            ) : tab === "assets" ? (
              <div className="mt-6">
                <AssetGroupsPanel
                  groups={data.workspaceAssetGroups}
                  reload={reload}
                  agentId={selectedId ?? undefined}
                />
              </div>
            ) : selectedAgent ? (
              <div className="mt-6 grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
                <AgentList
                  agents={data.agents}
                  selectedAgentId={selectedId}
                  attachedAgentIds={data.agentIdsWithConnection}
                  renameAgent={renameAgent}
                  archiveAgent={archiveAgent}
                />
                <AgentConfigForm
                  key={`${selectedAgent.id}-${selectedAgent.updated_at}`}
                  agent={selectedAgent}
                  availableTools={data.tools}
                  availableSkills={data.skills}
                  responseTemplateGroups={data.responseTemplateGroups}
                  workspaceContextGroups={data.workspaceContextGroups}
                  handoffTopicGroups={data.handoffTopicGroups}
                  workspaceAssetGroups={data.workspaceAssetGroups}
                  connections={agentConnectionOptions}
                  onSaved={() => {
                    void reload();
                    navigate(`${wsPath("/agent")}?agentId=${selectedAgent.id}&success=agent_saved`);
                  }}
                />
              </div>
            ) : (
              <p className="mt-7 rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-muted-foreground">
                No agents yet. Click &quot;Create New Agent&quot; to get started.
              </p>
            )}
          </section>
        )
      }
    />
  );
}

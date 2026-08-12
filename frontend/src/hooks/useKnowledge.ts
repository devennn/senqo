import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/context/workspace";
import type {
  AgentConfigRecord,
  WorkspaceContextGroupSummary,
  WorkspaceHandoffTopicGroupSummary,
  WorkspaceResponseTemplateGroupSummary,
} from "@/types/repositories";

export type KnowledgePageData = {
  agents: AgentConfigRecord[];
  responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
  handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
  workspaceContextGroups: WorkspaceContextGroupSummary[];
};

function normalizeAgent(a: AgentConfigRecord): AgentConfigRecord {
  return {
    ...a,
    response_template_groups: Array.isArray(a.response_template_groups) ? [...a.response_template_groups] : [],
    handoff_topic_groups: Array.isArray(a.handoff_topic_groups) ? [...a.handoff_topic_groups] : [],
    context_groups: Array.isArray(a.context_groups) ? [...a.context_groups] : [],
    asset_groups: Array.isArray(a.asset_groups) ? [...a.asset_groups] : [],
    handoff_notify_user_ids: Array.isArray(a.handoff_notify_user_ids)
      ? a.handoff_notify_user_ids.map(String)
      : [],
  };
}

/** Knowledge page data: agents + knowledge group summaries (no tools/skills/connections). */
export function useKnowledge() {
  const { workspaceId } = useWorkspace();
  const [data, setData] = useState<KnowledgePageData>({
    agents: [],
    responseTemplateGroups: [],
    handoffTopicGroups: [],
    workspaceContextGroups: [],
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!workspaceId) return;
      if (!options?.silent) setLoading(true);
      try {
        const res = await api.get<{
          agents: AgentConfigRecord[];
          responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
          handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
          workspaceContextGroups?: WorkspaceContextGroupSummary[];
        }>("/api/user/agents", { workspaceId });
        setData({
          agents: res.agents.map(normalizeAgent),
          responseTemplateGroups: res.responseTemplateGroups ?? [],
          handoffTopicGroups: res.handoffTopicGroups ?? [],
          workspaceContextGroups: res.workspaceContextGroups ?? [],
        });
      } catch {
        // Page shows empty/loading; avoid unhandled rejection toast.
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, reload };
}

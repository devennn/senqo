import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useWorkspace } from "@/context/workspace";
import type {
  AgentConfigRecord,
  WorkspaceCustomToolListItem,
  WorkspaceAssetGroupSummary,
  WorkspaceContextGroupSummary,
  WorkspaceHandoffTopicGroupSummary,
  WorkspaceResponseTemplateGroupSummary,
  WorkspaceSkillDefinitionRecord,
  WhatsappConnection,
} from "@/types/repositories";

export type AgentPageData = {
  agents: AgentConfigRecord[];
  agentIdsWithConnection: string[];
  responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
  handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
  workspaceContextGroups: WorkspaceContextGroupSummary[];
  workspaceAssetGroups: WorkspaceAssetGroupSummary[];
  tools: WorkspaceCustomToolListItem[];
  skills: WorkspaceSkillDefinitionRecord[];
  connections: WhatsappConnection[];
};

export function useAgents() {
  const navigate = useNavigate();
  const { workspaceId, wsPath } = useWorkspace();
  const [data, setData] = useState<AgentPageData>({
    agents: [],
    agentIdsWithConnection: [],
    responseTemplateGroups: [],
    handoffTopicGroups: [],
    workspaceContextGroups: [],
    workspaceAssetGroups: [],
    tools: [],
    skills: [],
    connections: [],
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!workspaceId) return;
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const requestOptions = { workspaceId };
      const [agentsRes, toolsRes, skillsRes, connectionsRes] = await Promise.all([
        api.get<{
          agents: AgentConfigRecord[];
          agentIdsWithConnection: string[];
          responseTemplateGroups: WorkspaceResponseTemplateGroupSummary[];
          handoffTopicGroups: WorkspaceHandoffTopicGroupSummary[];
          workspaceContextGroups?: WorkspaceContextGroupSummary[];
          workspaceAssetGroups?: WorkspaceAssetGroupSummary[];
        }>("/api/user/agents", requestOptions),
        api.get<{ tools: WorkspaceCustomToolListItem[] }>("/api/user/custom-tools", requestOptions),
        api.get<{ skills: WorkspaceSkillDefinitionRecord[] }>("/api/user/skills", requestOptions),
        api.get<{ connections: WhatsappConnection[] }>("/api/user/connections", requestOptions),
      ]);
      setData({
        agents: agentsRes.agents.map((a): AgentConfigRecord => ({
          ...a,
          response_template_groups: Array.isArray(a.response_template_groups)
            ? [...a.response_template_groups]
            : [],
          handoff_topic_groups: Array.isArray(a.handoff_topic_groups) ? [...a.handoff_topic_groups] : [],
          context_groups: Array.isArray(a.context_groups) ? [...a.context_groups] : [],
          asset_groups: Array.isArray(a.asset_groups) ? [...a.asset_groups] : [],
        })),
        agentIdsWithConnection: agentsRes.agentIdsWithConnection,
        responseTemplateGroups: agentsRes.responseTemplateGroups ?? [],
        handoffTopicGroups: agentsRes.handoffTopicGroups ?? [],
        workspaceContextGroups: agentsRes.workspaceContextGroups ?? [],
        workspaceAssetGroups: agentsRes.workspaceAssetGroups ?? [],
        tools: toolsRes.tools,
        skills: skillsRes.skills,
        connections: connectionsRes.connections,
      });
    } catch {
      // Avoid unhandled rejection toast; page shows empty/loading state.
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createAgent = useCallback(async () => {
    const res = await api.post<{ id: string }>("/api/user/agents");
    await reload();
    navigate(`${wsPath("/agent")}?agentId=${res.id}`);
  }, [reload, navigate, wsPath]);

  const archiveAgent = useCallback(async (formData: FormData) => {
    const id = String(formData.get("agentId") ?? "");
    try {
      await api.post(`/api/user/agents/${id}/archive`);
      await reload();
      navigate(`${wsPath("/agent")}?success=agent_archived`);
    } catch (e) {
      navigate(`${wsPath("/agent")}?agentId=${id}&error=${encodeURIComponent(String((e as Error).message))}`);
    }
  }, [reload, navigate, wsPath]);

  const deleteAgent = useCallback(async (formData: FormData) => {
    const id = String(formData.get("agentId") ?? "");
    try {
      await api.delete(`/api/user/agents/${id}`);
      await reload();
      navigate(`${wsPath("/agent")}?success=agent_deleted`);
    } catch (e) {
      navigate(`${wsPath("/agent")}?agentId=${id}&error=${encodeURIComponent(String((e as Error).message))}`);
    }
  }, [reload, navigate, wsPath]);

  const renameAgent = useCallback(async (formData: FormData) => {
    const id = String(formData.get("agentId") ?? "");
    const profileName = String(formData.get("profileName") ?? "").trim();
    if (!id || !profileName) {
      return false;
    }

    const agent = data.agents.find((entry) => entry.id === id);
    if (!agent) {
      navigate(`${wsPath("/agent")}?agentId=${id}&error=agent_not_found`);
      return false;
    }

    const attachedConnectionId =
      data.connections.find((connection) => connection.agent_config_id === id)?.id ?? null;

    try {
      await api.put(`/api/user/agents/${id}`, {
        profileName,
        behavior: agent.behavior,
        tools: Array.isArray(agent.tools) ? agent.tools : [],
        skills: Array.isArray(agent.skills) ? agent.skills : [],
        responseTemplateGroups: Array.isArray(agent.response_template_groups) ? agent.response_template_groups : [],
        contextGroups: Array.isArray(agent.context_groups) ? agent.context_groups : [],
        handoffTopicGroups: Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : [],
        assetGroups: Array.isArray(agent.asset_groups) ? agent.asset_groups : [],
        attachedConnectionId,
        autoAssignConversationLabels: agent.auto_assign_conversation_labels !== false,
      });
      await reload();
      navigate(`${wsPath("/agent")}?agentId=${id}`);
      return true;
    } catch (e) {
      navigate(`${wsPath("/agent")}?agentId=${id}&error=${encodeURIComponent(String((e as Error).message))}`);
      return false;
    }
  }, [data.agents, data.connections, reload, navigate, wsPath]);

  return { data, loading, reload, createAgent, archiveAgent, deleteAgent, renameAgent };
}

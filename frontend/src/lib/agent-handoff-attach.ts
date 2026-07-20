import type { AgentConfigRecord } from "@/types/repositories";

export function agentHasHandoffGroup(agent: AgentConfigRecord, groupId: string): boolean {
  return (Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : []).includes(
    groupId,
  );
}

export function sortedHandoffIds(ids: Iterable<string>): string[] {
  return [...ids].sort();
}

export function agentHandoffNotifyUserIds(agent: AgentConfigRecord): string[] {
  return sortedHandoffIds(
    Array.isArray(agent.handoff_notify_user_ids) ? agent.handoff_notify_user_ids : [],
  );
}

/** Shared notify list when every attached agent has the same recipients; otherwise empty. */
export function commonHandoffNotifyUserIds(
  agents: AgentConfigRecord[],
  groupId: string,
): string[] {
  const attached = agents.filter((a) => agentHasHandoffGroup(a, groupId));
  if (attached.length === 0) return [];
  const first = agentHandoffNotifyUserIds(attached[0]).join(",");
  return attached.every((a) => agentHandoffNotifyUserIds(a).join(",") === first)
    ? agentHandoffNotifyUserIds(attached[0])
    : [];
}

export function nextHandoffGroups(
  agent: AgentConfigRecord,
  groupId: string,
  attach: boolean,
): string[] {
  const current = Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : [];
  const without = current.filter((id) => id !== groupId);
  return attach ? sortedHandoffIds([...without, groupId]) : sortedHandoffIds(without);
}

export type HandoffAttachAgentPut = {
  profileName: string;
  behavior: string;
  tools: string[];
  skills: string[];
  handoffTopicGroups: string[];
  handoffNotifyUserIds?: string[];
};

/** Builds agent update payloads for attaching/detaching this group and notify list. */
export function buildHandoffAttachPuts(
  agents: AgentConfigRecord[],
  groupId: string,
  selectedAgentIds: ReadonlySet<string>,
  notifyUserIds: string[],
): Array<{ agentId: string; body: HandoffAttachAgentPut }> {
  const puts: Array<{ agentId: string; body: HandoffAttachAgentPut }> = [];
  for (const agent of agents) {
    const attach = selectedAgentIds.has(agent.id);
    const groups = nextHandoffGroups(agent, groupId, attach);
    const prevGroups = sortedHandoffIds(
      Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : [],
    );
    const groupsChanged = prevGroups.join(",") !== groups.join(",");
    const notifyChanged =
      attach && agentHandoffNotifyUserIds(agent).join(",") !== notifyUserIds.join(",");
    if (!groupsChanged && !notifyChanged) continue;

    puts.push({
      agentId: agent.id,
      body: {
        profileName: agent.profile_name,
        behavior: agent.behavior ?? "",
        tools: Array.isArray(agent.tools) ? agent.tools : [],
        skills: Array.isArray(agent.skills) ? agent.skills : [],
        handoffTopicGroups: groups,
        ...(attach ? { handoffNotifyUserIds: notifyUserIds } : {}),
      },
    });
  }
  return puts;
}

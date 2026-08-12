import type { AgentConfigRecord } from "@/types/repositories";

export type KnowledgeAttachmentKind = "context" | "templates" | "handoff";

function attachmentIds(agent: AgentConfigRecord, kind: KnowledgeAttachmentKind): string[] {
  if (kind === "context") return agent.context_groups;
  if (kind === "templates") return agent.response_template_groups;
  return agent.handoff_topic_groups;
}

/** Profile names of agents that attach the given workspace knowledge group. */
export function agentsUsingKnowledgeGroup(
  agents: AgentConfigRecord[],
  groupId: string,
  kind: KnowledgeAttachmentKind,
): string[] {
  return agents
    .filter((agent) => attachmentIds(agent, kind).includes(groupId))
    .map((agent) => agent.profile_name.trim() || "Untitled agent");
}

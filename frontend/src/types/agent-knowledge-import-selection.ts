export type AgentKnowledgeImportItemDisposition = "pending" | "accepted" | "discarded" | "applied";

export type AgentKnowledgeImportGroupDisposition = "pending" | "accepted" | "discarded";

export type AgentKnowledgeImportSelection = {
  contextGroups: Record<
    string,
    { disposition: AgentKnowledgeImportGroupDisposition; facts: Record<string, AgentKnowledgeImportItemDisposition> }
  >;
  skills: Record<string, AgentKnowledgeImportItemDisposition>;
  templateGroups: Record<
    string,
    {
      disposition: AgentKnowledgeImportGroupDisposition;
      entries: Record<string, AgentKnowledgeImportItemDisposition>;
    }
  >;
};

export type AgentKnowledgeImportWorkspaceRefs = {
  contextGroups: Record<string, string>;
  templateGroups: Record<string, string>;
};

export type AgentKnowledgeImportApplyTarget =
  | { kind: "context-group"; groupId: string }
  | { kind: "context-fact"; groupId: string; factId: string }
  | { kind: "skill"; skillId: string }
  | { kind: "template-group"; groupId: string }
  | { kind: "template-entry"; groupId: string; entryId: string };

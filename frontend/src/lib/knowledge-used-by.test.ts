import { describe, expect, it } from "vitest";
import { agentsUsingKnowledgeGroup } from "@/lib/knowledge-used-by";
import type { AgentConfigRecord } from "@/types/repositories";

function agent(partial: Partial<AgentConfigRecord> & Pick<AgentConfigRecord, "id" | "profile_name">): AgentConfigRecord {
  return {
    behavior: "",
    tools: [],
    skills: [],
    updated_at: "2026-01-01T00:00:00.000Z",
    first_used_at: null,
    auto_assign_conversation_labels: true,
    response_template_groups: [],
    handoff_topic_groups: [],
    context_groups: [],
    asset_groups: [],
    handoff_notify_user_ids: [],
    ...partial,
  };
}

describe("knowledge-used-by", () => {
  // Invert agent attachment arrays so Knowledge sidebars can show “Used by”.
  it("agentsUsingKnowledgeGroup → returns profile names for matching kind", () => {
    const agents = [
      agent({ id: "a1", profile_name: "Support", context_groups: ["g1"] }),
      agent({ id: "a2", profile_name: "Sales", context_groups: ["g2"], response_template_groups: ["g1"] }),
      agent({ id: "a3", profile_name: "Ops", handoff_topic_groups: ["g1"] }),
    ];
    expect(agentsUsingKnowledgeGroup(agents, "g1", "context")).toEqual(["Support"]);
    expect(agentsUsingKnowledgeGroup(agents, "g1", "templates")).toEqual(["Sales"]);
    expect(agentsUsingKnowledgeGroup(agents, "g1", "handoff")).toEqual(["Ops"]);
    expect(agentsUsingKnowledgeGroup(agents, "missing", "context")).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import {
  agentHasHandoffGroup,
  commonHandoffNotifyUserIds,
  nextHandoffGroups,
} from "@/lib/agent-handoff-attach";
import type { AgentConfigRecord } from "@/types/repositories";

function agent(partial: Partial<AgentConfigRecord> & { id: string }): AgentConfigRecord {
  return {
    profile_name: "Agent",
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

describe("agent-handoff-attach helpers", () => {
  // Attached agents are detected from handoff_topic_groups.
  it("agentHasHandoffGroup → true when group id is listed", () => {
    expect(agentHasHandoffGroup(agent({ id: "a1", handoff_topic_groups: ["g1"] }), "g1")).toBe(
      true,
    );
    expect(agentHasHandoffGroup(agent({ id: "a1", handoff_topic_groups: ["g2"] }), "g1")).toBe(
      false,
    );
  });

  // Attach/detach updates the group list without duplicates.
  it("nextHandoffGroups → adds or removes the group id", () => {
    const a = agent({ id: "a1", handoff_topic_groups: ["g0"] });
    expect(nextHandoffGroups(a, "g1", true)).toEqual(["g0", "g1"]);
    expect(nextHandoffGroups(a, "g0", false)).toEqual([]);
  });

  // Shared notify list is returned only when all attached agents match.
  it("commonHandoffNotifyUserIds → empty when attached agents disagree", () => {
    const agents = [
      agent({ id: "a1", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u1"] }),
      agent({ id: "a2", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u2"] }),
    ];
    expect(commonHandoffNotifyUserIds(agents, "g1")).toEqual([]);
    expect(
      commonHandoffNotifyUserIds(
        [
          agent({ id: "a1", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u1", "u2"] }),
          agent({ id: "a2", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u2", "u1"] }),
        ],
        "g1",
      ),
    ).toEqual(["u1", "u2"]);
  });
});

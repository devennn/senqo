import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api";
import {
  agentHasHandoffGroup,
  buildHandoffAttachPuts,
  commonHandoffNotifyUserIds,
  handoffAttachSaveErrorMessage,
  nextHandoffGroups,
  unavailableNotifySelections,
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

describe("buildHandoffAttachPuts", () => {
  // Notify ids are only sent when the selection actually changed, so attach-only saves
  // never overwrite stored notify lists (including stale ones the dialog flags).
  it("sends notify ids only when the notify selection changed", () => {
    const agents = [
      agent({ id: "a1", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u1"] }),
      agent({ id: "a2", handoff_topic_groups: [] }),
    ];

    const attachOnly = buildHandoffAttachPuts(agents, "g1", new Set(["a1", "a2"]), ["u1"], false);
    expect(attachOnly).toEqual([
      {
        agentId: "a2",
        body: {
          profileName: "Agent",
          behavior: "",
          tools: [],
          skills: [],
          handoffTopicGroups: ["g1"],
        },
      },
    ]);

    const notifyChanged = buildHandoffAttachPuts(agents, "g1", new Set(["a1"]), ["u1", "u2"], true);
    expect(notifyChanged).toEqual([
      {
        agentId: "a1",
        body: expect.objectContaining({ handoffNotifyUserIds: ["u1", "u2"] }),
      },
    ]);
  });

  // When attached agents hold different notify lists (common list empty), an attach-only
  // save must leave those stored lists intact.
  it("keeps divergent notify lists when only agents change", () => {
    const agents = [
      agent({ id: "a1", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u1"] }),
      agent({ id: "a2", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u2"] }),
      agent({ id: "a3", handoff_topic_groups: [] }),
    ];

    const puts = buildHandoffAttachPuts(agents, "g1", new Set(["a1", "a2", "a3"]), [], false);

    expect(puts.map((p) => p.agentId)).toEqual(["a3"]);
    expect(puts[0].body.handoffNotifyUserIds).toBeUndefined();
  });

  // Detaching writes only the group list; notify ids stay untouched on the detached agent.
  it("omits notify ids when detaching a group", () => {
    const agents = [
      agent({ id: "a1", handoff_topic_groups: ["g1"], handoff_notify_user_ids: ["u1"] }),
    ];

    const puts = buildHandoffAttachPuts(agents, "g1", new Set(), ["u2"], true);

    expect(puts).toEqual([
      {
        agentId: "a1",
        body: {
          profileName: "Agent",
          behavior: "",
          tools: [],
          skills: [],
          handoffTopicGroups: [],
        },
      },
    ]);
  });
});

describe("unavailableNotifySelections", () => {
  // Stored notify users without a verified phone are flagged; missing members are flagged
  // as not in the workspace so the dialog can explain why saving is blocked.
  it("flags stored users without verified phones or membership", () => {
    const recipients = [{ userId: "u1", email: "ops@senqo.app", phone: "+15551234567" }];
    const membersById = new Map([
      ["u1", { email: "ops@senqo.app" }],
      ["u2", { email: "pending@senqo.app" }],
    ]);

    expect(
      unavailableNotifySelections({ notifyUserIds: ["u1", "u2", "u3"], recipients, membersById }),
    ).toEqual([
      { userId: "u2", email: "pending@senqo.app", reason: "not_verified" },
      { userId: "u3", email: null, reason: "not_member" },
    ]);
  });
});

describe("handoffAttachSaveErrorMessage", () => {
  // The dialog names the rejected teammate instead of showing the raw error code.
  it("names the unverified teammate from the API error", () => {
    const membersById = new Map([["u2", { email: "pending@senqo.app" }]]);
    const error = new ApiError(400, {
      error: "handoff_notify_user_unverified",
      userId: "u2",
    });

    expect(handoffAttachSaveErrorMessage(error, membersById)).toBe(
      "pending@senqo.app has no verified phone in this workspace. Uncheck them and save again.",
    );
  });

  // Older responses without a userId still produce an actionable generic message.
  it("falls back to a generic message when the user id is unknown", () => {
    const error = new ApiError(400, { error: "handoff_notify_user_unverified" });

    expect(handoffAttachSaveErrorMessage(error, new Map())).toBe(
      "A selected notify person has no verified phone in this workspace. Uncheck them and save again.",
    );
  });

  // Other failures keep their original message so unrelated errors stay visible.
  it("passes through unrelated error messages", () => {
    expect(handoffAttachSaveErrorMessage(new Error("network down"), new Map())).toBe("network down");
  });
});
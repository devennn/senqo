import { describe, it, expect } from "vitest";
import type {
  AgentConfigRecord,
  WorkspaceHandoffTopicGroupSummary,
} from "@/types/repositories";
import {
  agentConfigFormSnapshotsEqual,
  agentHandoffTopicGroupsDirty,
  buildAgentConfigFormBaseline,
  readAgentConfigFormSnapshot,
} from "@/lib/agent-config-form-snapshot";

function agent(overrides: Partial<AgentConfigRecord> = {}): AgentConfigRecord {
  return {
    id: "a1",
    profile_name: "Bot",
    behavior: "Helpful",
    tools: [],
    skills: [],
    updated_at: "2026-01-01T00:00:00.000Z",
    first_used_at: null,
    response_template_groups: [],
    context_groups: [],
    asset_groups: [],
    handoff_topic_groups: [],
    handoff_notify_user_ids: [],
    auto_assign_conversation_labels: true,
    ...overrides,
  };
}

const handoffGroup: WorkspaceHandoffTopicGroupSummary = {
  id: "hg1",
  name: "Billing",
  updated_at: "2026-01-01T00:00:00.000Z",
  entry_count: 2,
};

describe("agent handoff topic snapshot helpers", () => {
  // Baseline keeps only handoff groups that still exist in the workspace list.
  it("buildAgentConfigFormBaseline → includes selected handoff topic groups", () => {
    const baseline = buildAgentConfigFormBaseline({
      agent: agent({ handoff_topic_groups: ["hg1", "missing"] }),
      connections: [],
      availableTools: [],
      availableSkills: [],
      responseTemplateGroups: [],
      workspaceContextGroups: [],
      workspaceAssetGroups: [],
      handoffTopicGroups: [handoffGroup],
    });
    expect(baseline.handoffTopicGroups).toEqual(["hg1"]);
  });

  // Dirty flag drives the inline Save next to Topics that need a human.
  it("agentHandoffTopicGroupsDirty → true when selection differs", () => {
    const baseline = buildAgentConfigFormBaseline({
      agent: agent({ handoff_topic_groups: ["hg1"] }),
      connections: [],
      availableTools: [],
      availableSkills: [],
      responseTemplateGroups: [],
      workspaceContextGroups: [],
      workspaceAssetGroups: [],
      handoffTopicGroups: [handoffGroup],
    });
    expect(
      agentHandoffTopicGroupsDirty(baseline, {
        ...baseline,
        handoffTopicGroups: [],
      }),
    ).toBe(true);
    expect(agentHandoffTopicGroupsDirty(baseline, { ...baseline })).toBe(false);
  });

  // Overall dirty equality must treat handoff topics as a first-class field.
  it("agentConfigFormSnapshotsEqual → false when handoffTopicGroups differ", () => {
    const a = buildAgentConfigFormBaseline({
      agent: agent({ handoff_topic_groups: ["hg1"] }),
      connections: [],
      availableTools: [],
      availableSkills: [],
      responseTemplateGroups: [],
      workspaceContextGroups: [],
      workspaceAssetGroups: [],
      handoffTopicGroups: [handoffGroup],
    });
    const b = { ...a, handoffTopicGroups: [] as const };
    expect(agentConfigFormSnapshotsEqual(a, b)).toBe(false);
    expect(agentConfigFormSnapshotsEqual(a, { ...a })).toBe(true);
  });

  // Profile form checkboxes named handoffTopicGroups are read into the snapshot.
  it("readAgentConfigFormSnapshot → reads handoffTopicGroups checkboxes", () => {
    const form = document.createElement("form");
    for (const id of ["hg1", "hg2"]) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "handoffTopicGroups";
      input.value = id;
      input.checked = true;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    const snap = readAgentConfigFormSnapshot(form);
    expect(snap.handoffTopicGroups).toEqual(["hg1", "hg2"]);
    form.remove();
  });
});

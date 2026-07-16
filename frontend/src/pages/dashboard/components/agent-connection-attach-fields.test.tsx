import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentConnectionAttachFields } from "@/pages/dashboard/components/agent-connection-attach-fields";
import { CreateTaskForm } from "@/pages/dashboard/tasks/components/create-task-form";
import {
  agentConnectionSectionDirty,
  buildAgentConfigFormBaseline,
} from "@/lib/agent-config-form-snapshot";
import type { AgentConfigRecord } from "@/types/repositories";

vi.mock("@/lib/datetime", () => ({
  localDateTimeInputValueToIsoUtc: () => "2026-01-01T00:00:00.000Z",
}));

describe("agentConnectionSectionDirty", () => {
  const agent: AgentConfigRecord = {
    id: "a1",
    profile_name: "Agent",
    behavior: "",
    tools: [],
    skills: [],
    response_template_groups: [],
    context_groups: [],
    asset_groups: [],
    handoff_topic_groups: [],
    auto_assign_conversation_labels: true,
  };

  // Sorted id lists with same members → not dirty, needed so reordering checkboxes does not enable Save.
  it("is clean when attached ids match in any order", () => {
    const baseline = buildAgentConfigFormBaseline({
      agent,
      connections: [
        { id: "c1", displayName: "A", phoneNumber: null, attachedAgentId: "a1" },
        { id: "c2", displayName: "B", phoneNumber: null, attachedAgentId: "a1" },
      ],
      availableTools: [],
      availableSkills: [],
      responseTemplateGroups: [],
      workspaceContextGroups: [],
      workspaceAssetGroups: [],
      handoffTopicGroups: [],
    });
    expect(
      agentConnectionSectionDirty(baseline, {
        ...baseline,
        attachedConnectionIds: ["c2", "c1"],
      }),
    ).toBe(false);
  });

  // Different attachment set → dirty, needed to show Save when adding/removing a line.
  it("is dirty when attached ids differ", () => {
    const baseline = buildAgentConfigFormBaseline({
      agent,
      connections: [
        { id: "c1", displayName: "A", phoneNumber: null, attachedAgentId: "a1" },
      ],
      availableTools: [],
      availableSkills: [],
      responseTemplateGroups: [],
      workspaceContextGroups: [],
      workspaceAssetGroups: [],
      handoffTopicGroups: [],
    });
    expect(
      agentConnectionSectionDirty(baseline, {
        ...baseline,
        attachedConnectionIds: ["c1", "c2"],
      }),
    ).toBe(true);
  });
});

describe("AgentConnectionAttachFields", () => {
  // Clean section → Save hidden/disabled pattern via sectionDirty false; both lines listed.
  it("lists available connections and shows active labels when selected", () => {
    render(
      <form>
        <AgentConnectionAttachFields
          agentId="a1"
          connections={[
            { id: "c1", displayName: "Line A", phoneNumber: "+111", attachedAgentId: "a1" },
            { id: "c2", displayName: "Line B", phoneNumber: "+222", attachedAgentId: null },
          ]}
          sectionDirty={false}
          saving={false}
        />
      </form>,
    );
    expect(screen.getByRole("checkbox", { name: /Line A/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Line B/i })).not.toBeChecked();
    expect(screen.getByText(/Active on/i)).toBeInTheDocument();
  });

  // Dirty → Save enabled, needed for inline save gating.
  it("enables Save when section is dirty", () => {
    render(
      <form>
        <AgentConnectionAttachFields
          agentId="a1"
          connections={[
            { id: "c1", displayName: "Line A", phoneNumber: null, attachedAgentId: null },
          ]}
          sectionDirty
          saving={false}
        />
      </form>,
    );
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeEnabled();
  });
});

describe("CreateTaskForm connection picker", () => {
  // Multi-attached agent → connection select required and Create disabled until chosen.
  it("requires WhatsApp connection when agent has multiple lines", async () => {
    const user = userEvent.setup();
    const createTask = vi.fn();
    render(
      <CreateTaskForm
        agents={[
          {
            id: "a1",
            profile_name: "Shared",
            connections: [
              { id: "c1", display_name: "Line A", phone_number: "+1" },
              { id: "c2", display_name: "Line B", phone_number: "+2" },
            ],
          },
        ]}
        contacts={[]}
        createTask={createTask}
      />,
    );
    expect(screen.getByLabelText(/WhatsApp connection/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /Create task/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/WhatsApp connection/i), "c1");
    expect(screen.getByRole("button", { name: /Create task/i })).toBeEnabled();
  });

  // Single attached line → no visible connection picker; Create enabled.
  it("hides connection picker when agent has one line", () => {
    render(
      <CreateTaskForm
        agents={[
          {
            id: "a1",
            profile_name: "Shared",
            connections: [{ id: "c1", display_name: "Line A", phone_number: "+1" }],
          },
        ]}
        contacts={[]}
        createTask={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/WhatsApp connection/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Create task/i })).toBeEnabled();
  });
});

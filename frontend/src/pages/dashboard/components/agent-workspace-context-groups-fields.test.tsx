import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  agentWorkspaceContextGroupsDirty,
  buildAgentConfigFormBaseline,
  readAgentConfigFormSnapshot,
} from "@/lib/agent-config-form-snapshot";
import { AGENT_ATTACH_UI_PAGE_SIZE } from "@/lib/agent-attach-limits";
import { AgentWorkspaceContextGroupsFields } from "@/pages/dashboard/components/agent-workspace-context-groups-fields";
import type { WorkspaceContextGroupSummary } from "@/types/repositories";

function makeGroups(count: number): WorkspaceContextGroupSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `g${index + 1}`,
    name: `Group ${index + 1}`,
    updated_at: "2026-01-01T00:00:00.000Z",
    entry_count: index + 1,
  }));
}

describe("AgentWorkspaceContextGroupsFields", () => {
  // Long group lists stay short (one page of rows), and a selected group paged out of view must
  // still be attached by id when the profile form saves.
  it("pages groups and keeps an off-page selection attached by id", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <form>
          <AgentWorkspaceContextGroupsFields
            groups={makeGroups(10)}
            selectedIds={new Set(["g9"])}
            contextTabHref="/ws/knowledge?tab=context"
            subsectionDirty={false}
            saving={false}
          />
        </form>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(AGENT_ATTACH_UI_PAGE_SIZE);

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByRole("checkbox", { name: /^Group 9\b/ })).toBeChecked();
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(new FormData(form!).getAll("contextGroups").map(String)).toEqual(["g9"]);
  });

  // The profile form recomputes dirty sections from FormData inside the same change event, so the
  // inline Save must appear on the first click of a controlled checkbox.
  it("marks the workspace context section dirty on the first group check", async () => {
    const user = userEvent.setup();
    const baseline = buildAgentConfigFormBaseline({
      agent: {
        id: "a1",
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
      },
      connections: [],
      availableTools: [],
      availableSkills: [],
      responseTemplateGroups: [],
      workspaceContextGroups: [],
      workspaceAssetGroups: [],
      handoffTopicGroups: [],
    });
    let dirty = false;
    render(
      <MemoryRouter>
        <form
          onChange={(event) => {
            dirty = agentWorkspaceContextGroupsDirty(
              baseline,
              readAgentConfigFormSnapshot(event.currentTarget),
            );
          }}
        >
          <AgentWorkspaceContextGroupsFields
            groups={makeGroups(6)}
            selectedIds={new Set()}
            contextTabHref="/ws/knowledge?tab=context"
            subsectionDirty={false}
            saving={false}
          />
        </form>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("checkbox", { name: /^Group 1\b/ }));

    expect(dirty).toBe(true);
  });
});

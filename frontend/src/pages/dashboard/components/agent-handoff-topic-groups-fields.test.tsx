import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AgentHandoffTopicGroupsFields } from "@/pages/dashboard/components/agent-handoff-topic-groups-fields";

describe("AgentHandoffTopicGroupsFields", () => {
  // Selected handoff groups appear as checked checkboxes for the profile form.
  it("renders group checkboxes with selected defaults", () => {
    render(
      <MemoryRouter>
        <AgentHandoffTopicGroupsFields
          groups={[
            {
              id: "g1",
              name: "Billing",
              updated_at: "2026-01-01T00:00:00.000Z",
              entry_count: 2,
            },
          ]}
          selectedIds={new Set(["g1"])}
          handoffTabHref="/ws/agent?tab=handoff"
          subsectionDirty={false}
          saving={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Topics that need a human")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Billing/ })).toBeChecked();
  });

  // Empty workspace lists point operators to the Human handoff tab.
  it("links to Human handoff when no groups exist", () => {
    render(
      <MemoryRouter>
        <AgentHandoffTopicGroupsFields
          groups={[]}
          selectedIds={new Set()}
          handoffTabHref="/ws/agent?tab=handoff"
          subsectionDirty={false}
          saving={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Human handoff/i })).toHaveAttribute(
      "href",
      "/ws/agent?tab=handoff",
    );
  });

  // Dirty subsection shows inline Save for the profile pattern.
  it("shows Save when subsectionDirty is true", () => {
    render(
      <MemoryRouter>
        <AgentHandoffTopicGroupsFields
          groups={[]}
          selectedIds={new Set()}
          handoffTabHref="/ws/agent?tab=handoff"
          subsectionDirty
          saving={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});

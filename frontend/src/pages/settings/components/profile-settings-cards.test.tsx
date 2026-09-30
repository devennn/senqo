import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileWorkspaceCard } from "@/pages/settings/components/profile-settings-cards";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function workspace(overrides = {}) {
  return {
    id: "ws-1",
    name: "Test WS",
    timezone: "Asia/Kuala_Lumpur",
    createdAt: "2026-01-01",
    role: "owner" as const,
    ...overrides,
  };
}

describe("ProfileWorkspaceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Operators must see the stored zone and cannot submit an unchanged form.
  it("shows the stored timezone and disables save until it changes", () => {
    render(
      <ProfileWorkspaceCard workspace={workspace()} loading={false} onSave={vi.fn()} />,
    );

    expect(screen.getByLabelText("Timezone")).toHaveValue("Asia/Kuala_Lumpur");
    expect(screen.getByRole("button", { name: "Save workspace" })).toBeDisabled();
  });

  // Changing the zone enables save and submits only the drifted slice.
  it("submits the timezone patch when the selection changes", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileWorkspaceCard workspace={workspace()} loading={false} onSave={onSave} />,
    );

    await user.selectOptions(screen.getByLabelText("Timezone"), "Europe/London");
    const save = screen.getByRole("button", { name: "Save workspace" });
    expect(save).toBeEnabled();
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith({ timezone: "Europe/London" });
  });

  // Members cannot edit settings; neither the select nor the save action is offered.
  it("disables editing for members", () => {
    render(
      <ProfileWorkspaceCard
        workspace={workspace({ role: "member" })}
        loading={false}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Timezone")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save workspace" })).not.toBeInTheDocument();
  });
});

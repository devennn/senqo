import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamMemberErrorAlertsToggle } from "@/pages/settings/components/team-member-error-alerts-toggle";
import type { TeamMemberRecord } from "@/types/repositories";

const mockPatch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  api: { patch: mockPatch },
}));

function buildMember(overrides: Partial<TeamMemberRecord> = {}): TeamMemberRecord {
  return {
    id: "user-1",
    userId: "user-1",
    email: "owner@senqo.app",
    role: "owner",
    joined_at: "2026-01-01T00:00:00.000Z",
    handoffPhones: [
      {
        connectionId: "conn-1",
        connectionName: "Ops Line",
        phone: "60123456789",
        status: "verified",
      },
    ],
    receivesErrorAlerts: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPatch.mockResolvedValue({ ok: true });
});

describe("TeamMemberErrorAlertsToggle", () => {
  // Opting in must be deliberate: the confirm dialog explains delivery, and only
  // after confirming does the PATCH enable the subscription.
  it("asks for confirmation and patches enabled true on confirm", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <TeamMemberErrorAlertsToggle
        member={buildMember()}
        canManage
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /receive ai error alerts/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Turn on alerts" }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("/api/user/team/error-alerts", {
        userId: "user-1",
        enabled: true,
      }),
    );
    expect(onChanged).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  // Cancelling the confirm dialog leaves the member opted out and sends nothing.
  it("does not patch when the confirm dialog is cancelled", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <TeamMemberErrorAlertsToggle
        member={buildMember()}
        canManage
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /receive ai error alerts/i }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockPatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /receive ai error alerts/i })).not.toBeChecked();
  });

  // Opting out is immediate — no dialog — so members can always silence alerts.
  it("patches enabled false immediately when unticking", async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <TeamMemberErrorAlertsToggle
        member={buildMember({ receivesErrorAlerts: true })}
        canManage
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /receive ai error alerts/i }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("/api/user/team/error-alerts", {
        userId: "user-1",
        enabled: false,
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Without a verified handoff phone there is nowhere to deliver alerts, so the tick is disabled.
  it("disables the tick without a verified handoff phone", () => {
    render(
      <TeamMemberErrorAlertsToggle
        member={buildMember({
          handoffPhones: [
            {
              connectionId: "conn-1",
              connectionName: "Ops Line",
              phone: "60123456789",
              status: "pending",
            },
          ],
        })}
        canManage
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: /receive ai error alerts/i }),
    ).toBeDisabled();
  });
});

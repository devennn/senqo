import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AgentHandoffNotifyField } from "@/pages/dashboard/components/agent-handoff-notify-field";

describe("AgentHandoffNotifyField", () => {
  // Verified recipients appear as checkboxes for multi-select notify.
  it("lists verified recipients as checkboxes", () => {
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[{ userId: "u1", email: "ops@senqo.app", phone: "15551234567" }]}
          selectedIds={new Set()}
          onToggle={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Notify on handoff")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /ops@senqo.app/ })).toBeInTheDocument();
  });

  // Empty recipients point users to Team settings.
  it("links to Team settings when no verified phones exist", () => {
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField recipients={[]} selectedIds={new Set()} onToggle={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Settings → Team/i })).toHaveAttribute(
      "href",
      "/settings/team",
    );
  });

  // Toggling a recipient reports the new checked state.
  it("calls onToggle when a recipient checkbox changes", async () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[{ userId: "u1", email: "ops@senqo.app", phone: "15551234567" }]}
          selectedIds={new Set()}
          onToggle={onToggle}
        />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /ops@senqo.app/ }));
    expect(onToggle).toHaveBeenCalledWith("u1", true);
  });

  // Long phone labels clamp to two lines; full text is on title for hover tooltip.
  it("clamps recipient text to two lines and exposes full label via title", () => {
    const phone =
      "+1 555 123 4567 via Main Line; +1 555 987 6543 via Backup Line; +1 555 000 1111 via Third";
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[{ userId: "u1", email: "ops@senqo.app", phone }]}
          selectedIds={new Set()}
          onToggle={() => {}}
        />
      </MemoryRouter>,
    );

    const text = screen.getByTitle(`ops@senqo.app (${phone})`);
    expect(text).toHaveClass("line-clamp-2");
  });
});


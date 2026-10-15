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
          unavailable={[]}
          status="ready"
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
        <AgentHandoffNotifyField
          recipients={[]}
          unavailable={[]}
          status="ready"
          selectedIds={new Set()}
          onToggle={() => {}}
        />
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
          unavailable={[]}
          status="ready"
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
          unavailable={[]}
          status="ready"
          selectedIds={new Set()}
          onToggle={() => {}}
        />
      </MemoryRouter>,
    );

    const text = screen.getByTitle(`ops@senqo.app (${phone})`);
    expect(text).toHaveClass("line-clamp-2");
  });

  // Stored notify users without a verified phone stay visible and checked with a hint,
  // so they can be unchecked instead of failing the save invisibly (the original bug).
  it("flags a selected notify user without a verified phone", () => {
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[]}
          unavailable={[{ userId: "u9", email: "stale@senqo.app", reason: "not_verified" }]}
          status="ready"
          selectedIds={new Set(["u9"])}
          onToggle={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("checkbox", { name: /stale@senqo.app/ })).toBeChecked();
    expect(screen.getByText(/No verified phone/)).toBeInTheDocument();
    expect(screen.getByText(/uncheck to remove/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Settings → Team/i })).not.toBeInTheDocument();
  });

  // Selected users who are no longer teammates get a distinct hint.
  it("flags a selected notify user who is not in the workspace", () => {
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[]}
          unavailable={[{ userId: "u9", email: "gone@senqo.app", reason: "not_member" }]}
          status="ready"
          selectedIds={new Set(["u9"])}
          onToggle={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Not in this workspace/)).toBeInTheDocument();
  });

  // Unchecking a flagged user reports the new state so the save payload can drop them.
  it("calls onToggle when a flagged notify user is unchecked", async () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[]}
          unavailable={[{ userId: "u9", email: "stale@senqo.app", reason: "not_verified" }]}
          status="ready"
          selectedIds={new Set(["u9"])}
          onToggle={onToggle}
        />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /stale@senqo.app/ }));
    expect(onToggle).toHaveBeenCalledWith("u9", false);
  });

  // While teammates load, show a loading note instead of the empty-team hint.
  it("shows loading copy while teammates load", () => {
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[]}
          unavailable={[]}
          status="loading"
          selectedIds={new Set()}
          onToggle={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Loading teammates/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Settings → Team/i })).not.toBeInTheDocument();
  });

  // When teammates fail to load, say so instead of claiming no verified phones exist.
  it("shows a reload note when teammates fail to load", () => {
    render(
      <MemoryRouter>
        <AgentHandoffNotifyField
          recipients={[]}
          unavailable={[]}
          status="error"
          selectedIds={new Set()}
          onToggle={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Couldn’t load teammates/)).toBeInTheDocument();
  });
});
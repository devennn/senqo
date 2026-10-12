import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { ApiError } from "@/lib/api";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogDescription: ({ children }: { children?: React.ReactNode }) =>
    children ? <div data-testid="dialog-description">{children}</div> : null,
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ wsPath: (path: string) => `/ws-1${path}` }),
}));

import { ConnectionDeleteDialog } from "./connection-delete-dialog";

function renderDialog(onConfirm: () => Promise<void>) {
  return render(
    <MemoryRouter>
      <ConnectionDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        displayName="Savor CS Main"
        isDeleting={false}
        onConfirm={onConfirm}
      />
    </MemoryRouter>,
  );
}

describe("ConnectionDeleteDialog", () => {
  // Blocked delete: the dialog must name the agent and link straight to its setup so the user can detach first.
  it("names the attached agent and links to its setup when the delete is blocked", async () => {
    const user = userEvent.setup();
    renderDialog(
      vi.fn().mockRejectedValue(
        new ApiError(409, {
          error: "connection_attached_to_agent",
          agentId: "agent-1",
          agentName: "Support",
          message: "blocked",
        }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Support")).toBeInTheDocument();
    expect(screen.getByText(/still live and attached to agent/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open agent setup" })).toHaveAttribute(
      "href",
      "/ws-1/agent?agentId=agent-1",
    );
  });

  // Other failures keep the plain error message so unexpected causes stay visible to the user.
  it("falls back to the raw error message for unknown failures", async () => {
    const user = userEvent.setup();
    renderDialog(vi.fn().mockRejectedValue(new Error("connection_delete_failed")));

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("connection_delete_failed")).toBeInTheDocument();
  });
});

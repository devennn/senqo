import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get: mockGet } };
});

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

import { ApiError } from "@/lib/api";
import { ConnectionDeleteDialog } from "./connection-delete-dialog";

function renderDialog(onConfirm: () => Promise<void>) {
  return render(
    <MemoryRouter>
      <ConnectionDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        connectionId="conn-1"
        displayName="Savor CS Main"
        isDeleting={false}
        onConfirm={onConfirm}
      />
    </MemoryRouter>,
  );
}

describe("ConnectionDeleteDialog", () => {
  // The dialog must show the fresh live status + attached agent and keep Delete unavailable while deleting
  // this line would silently stop the agent from replying.
  it("shows the live status and attached agent and disables delete when blocked", async () => {
    mockGet.mockResolvedValue({
      status: "connected",
      agent: { id: "agent-1", name: "Support" },
      deletable: false,
      blockedReason: "connection_attached_to_agent",
    });
    renderDialog(vi.fn());

    expect(await screen.findByText("Live")).toBeInTheDocument();
    expect(screen.getByTestId("connection-delete-agent")).toHaveTextContent("Support");
    expect(screen.getByText(/still live and attached to agent/i)).toBeInTheDocument();
    expect(screen.queryByText(/This removes/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open agent setup" })).toHaveAttribute(
      "href",
      "/ws-1/agent?agentId=agent-1",
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  // Delete stays disabled behind a "Checking…" label while the fresh live call is still running.
  it("disables delete while the preflight check is running", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    renderDialog(vi.fn());

    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
  });

  // When the preflight allows deleting, Delete is enabled and confirms normally.
  it("enables delete when the preflight allows deleting", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    mockGet.mockResolvedValue({
      status: "disconnected",
      agent: { id: "agent-1", name: "Support" },
      deletable: true,
      blockedReason: null,
    });
    renderDialog(onConfirm);

    await screen.findByText("Offline");
    expect(screen.getByText(/This removes/)).toBeInTheDocument();
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    expect(onConfirm).toHaveBeenCalled();
  });

  // Race fallback: if the server still rejects with the block code, the same guidance must appear.
  it("shows the block reason when the server rejects the delete", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({
      status: "disconnected",
      agent: null,
      deletable: true,
      blockedReason: null,
    });
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

    await screen.findByText("Offline");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/still live and attached to agent/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open agent setup" })).toHaveAttribute(
      "href",
      "/ws-1/agent?agentId=agent-1",
    );
  });

  // Other failures keep the plain error message so unexpected causes stay visible to the user.
  it("falls back to the raw error message for unknown failures", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({
      status: "disconnected",
      agent: null,
      deletable: true,
      blockedReason: null,
    });
    renderDialog(vi.fn().mockRejectedValue(new Error("connection_delete_failed")));

    await screen.findByText("Offline");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("connection_delete_failed")).toBeInTheDocument();
  });
});

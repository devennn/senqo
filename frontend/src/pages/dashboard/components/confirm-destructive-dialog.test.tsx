import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

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

import { ConfirmDestructiveDialog } from "./confirm-destructive-dialog";

describe("confirm-destructive-dialog", () => {
  it("opens and shows title and confirm button", () => {
    render(
      <ConfirmDestructiveDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete workspace"
        description="This action cannot be undone."
        confirmLabel="Delete"
        isConfirming={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Delete workspace")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <ConfirmDestructiveDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete workspace"
        confirmLabel="Delete"
        isConfirming={false}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("shows pendingConfirmLabel when isConfirming is true", () => {
    render(
      <ConfirmDestructiveDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete workspace"
        confirmLabel="Delete"
        pendingConfirmLabel="Deleting…"
        isConfirming={true}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Deleting…" })).toBeInTheDocument();
  });
});

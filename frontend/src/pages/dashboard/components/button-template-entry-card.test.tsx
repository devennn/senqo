import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ButtonTemplateEntryCard } from "@/pages/dashboard/components/button-template-entry-card";
import type { WorkspaceButtonTemplateEntryRecord } from "@/types/repositories";

const patchMock = vi.fn().mockResolvedValue({});

vi.mock("@/lib/api", () => ({
  api: {
    patch: (...args: unknown[]) => patchMock(...args),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

const entry: WorkspaceButtonTemplateEntryRecord = {
  id: "entry-1",
  sort_order: 0,
  title: "Confirm appointment",
  body: "Should I confirm your 3pm appointment?",
  buttons: [{ type: "quick_reply", label: "Yes", value: "yes" }],
};

function renderCard() {
  return render(
    <ButtonTemplateEntryCard
      groupId="group-1"
      entry={entry}
      labelIndex={1}
      onAfterMutation={async () => {}}
      onWorkspaceStale={async () => {}}
    />,
  );
}

describe("ButtonTemplateEntryCard", () => {
  beforeEach(() => {
    patchMock.mockClear();
  });

  // Cancel must throw away unsaved edits and close the editor, so nothing
  // half-edited stays on screen and no request is made.
  it("discards edits, collapses, and does not save on Cancel", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /Confirm appointment/ }));
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Changed title");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm appointment/ })).toBeInTheDocument();
    expect(patchMock).not.toHaveBeenCalled();
  });

  // Save is the primary action and must stay disabled until the draft actually
  // differs from the saved template.
  it("keeps Save disabled until the template is edited", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: /Confirm appointment/ }));
    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), " updated");

    expect(screen.getByRole("button", { name: "Save template" })).toBeEnabled();
  });
});

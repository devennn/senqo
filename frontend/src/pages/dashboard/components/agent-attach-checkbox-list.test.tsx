import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AGENT_ATTACH_UI_PAGE_SIZE } from "@/lib/agent-attach-limits";
import { AgentAttachCheckboxList } from "@/pages/dashboard/components/agent-attach-checkbox-list";

function makeItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `id-${index + 1}`,
    name: `Group ${index + 1}`,
    hint: `${index + 1} entries`,
  }));
}

function formPayload(container: HTMLElement, fieldName: string): string[] {
  const form = container.querySelector("form");
  if (!form) throw new Error("test form missing");
  return new FormData(form).getAll(fieldName).map(String).sort();
}

describe("AgentAttachCheckboxList", () => {
  // Long attach lists must stay short: only four rows per column (one page) render at a time.
  it("shows one page of items and pages through the rest", async () => {
    const user = userEvent.setup();
    render(
      <AgentAttachCheckboxList
        fieldName="contextGroups"
        items={makeItems(10)}
        selectedIds={new Set()}
      />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(AGENT_ATTACH_UI_PAGE_SIZE);
    expect(screen.getByRole("checkbox", { name: /^Group 1\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /^Group 9\b/ })).toBeNull();
    expect(screen.getByText("1–8 of 10")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByRole("checkbox", { name: /^Group 9\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /^Group 1\b/ })).toBeNull();
  });

  // A save right after load must not detach baseline groups that sit on page 2; each selected
  // id must appear exactly once in the payload even when its row is off-page.
  it("keeps off-page baseline selections in the form payload without duplicates", () => {
    const { container } = render(
      <form>
        <AgentAttachCheckboxList
          fieldName="contextGroups"
          items={makeItems(12)}
          selectedIds={new Set(["id-1", "id-9"])}
        />
      </form>,
    );

    expect(formPayload(container, "contextGroups")).toEqual(["id-1", "id-9"]);
  });

  // Checking a group then paging away (so its checkbox unmounts) must keep it in the payload.
  it("keeps a checked item in the form payload after paging away", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <AgentAttachCheckboxList
          fieldName="contextGroups"
          items={makeItems(12)}
          selectedIds={new Set()}
        />
      </form>,
    );

    await user.click(screen.getByRole("checkbox", { name: /^Group 2\b/ }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.queryByRole("checkbox", { name: /^Group 2\b/ })).toBeNull();
    expect(formPayload(container, "contextGroups")).toEqual(["id-2"]);
  });

  // Unchecking a baseline selection must remove it from the payload so the save detaches it.
  it("drops an unchecked item from the form payload", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <AgentAttachCheckboxList
          fieldName="contextGroups"
          items={makeItems(12)}
          selectedIds={new Set(["id-1", "id-9"])}
        />
      </form>,
    );

    await user.click(screen.getByRole("checkbox", { name: /^Group 1\b/ }));

    expect(formPayload(container, "contextGroups")).toEqual(["id-9"]);
  });

  // Paging away and back must show the selection the operator left behind, not the baseline.
  it("keeps checked state when returning to the first page", async () => {
    const user = userEvent.setup();
    render(
      <AgentAttachCheckboxList
        fieldName="contextGroups"
        items={makeItems(12)}
        selectedIds={new Set()}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /^Group 3\b/ }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Previous page" }));

    expect(screen.getByRole("checkbox", { name: /^Group 3\b/ })).toBeChecked();
  });

  // A full page (pageSize rows) fits without pagination controls.
  it("hides pagination when items fit on one page", () => {
    render(
      <AgentAttachCheckboxList
        fieldName="contextGroups"
        items={makeItems(AGENT_ATTACH_UI_PAGE_SIZE)}
        selectedIds={new Set()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
  });
});

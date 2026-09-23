import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "@/context/workspace";
import { CONTEXT_GROUPS_UI_PAGE_SIZE } from "@/lib/context-groups-limits";
import type { WorkspaceContextEntryRecord } from "@/types/repositories";
import { ContextGroupFactsBlock } from "./context-group-facts-block";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeAll(() => {
  // jsdom has no layout engine, so the deep-link scroll call would throw.
  Element.prototype.scrollIntoView = vi.fn();
});

function makeEntries(count: number): WorkspaceContextEntryRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    sort_order: i,
    title: `Fact title ${i + 1}`,
    body_text: `Fact body ${i + 1}`,
  }));
}

function renderBlock(entries: WorkspaceContextEntryRecord[], search: string) {
  return render(
    <MemoryRouter initialEntries={[`/ws-1/knowledge${search}`]}>
      <Routes>
        <Route
          path="/:workspaceId/*"
          element={
            <WorkspaceProvider>
              <ContextGroupFactsBlock
                groupId="g1"
                entries={entries}
                reloadGroup={async () => {}}
                onWorkspaceStale={async () => {}}
              />
            </WorkspaceProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ContextGroupFactsBlock", () => {
  // The reference chip in a conversation links here with contextEntryId set. Landing must
  // expand that exact fact so operators see the text that grounded the reply, not just the group.
  it("expands the fact named by contextEntryId", () => {
    renderBlock(makeEntries(3), "?tab=context&contextGroupId=g1&contextEntryId=e2");

    expect(screen.getByLabelText("Title")).toHaveValue("Fact title 2");
    expect(screen.getByLabelText("Facts")).toHaveValue("Fact body 2");
  });

  // Only the referenced fact may open; expanding siblings would bury the cited text
  // in a wall of editors.
  it("leaves facts other than contextEntryId collapsed", () => {
    renderBlock(makeEntries(3), "?tab=context&contextGroupId=g1&contextEntryId=e2");

    expect(screen.getAllByLabelText("Title")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Fact title 1/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  // Facts are paginated at CONTEXT_GROUPS_UI_PAGE_SIZE, so a referenced fact beyond page 1
  // is not mounted unless the block jumps to its page first.
  it("jumps to the page holding contextEntryId when it is past page one", () => {
    const entries = makeEntries(CONTEXT_GROUPS_UI_PAGE_SIZE + 2);
    const lastId = entries[entries.length - 1].id;
    renderBlock(entries, `?tab=context&contextGroupId=g1&contextEntryId=${lastId}`);

    expect(screen.getByLabelText("Title")).toHaveValue(
      `Fact title ${entries.length}`,
    );
  });

  // Opening Knowledge from the sidebar has no contextEntryId; nothing should auto-expand
  // or the group view would open an editor the operator did not ask for.
  it("expands nothing when contextEntryId is absent", () => {
    renderBlock(makeEntries(3), "?tab=context&contextGroupId=g1");

    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
});

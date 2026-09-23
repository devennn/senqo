import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { WorkspaceProvider } from "@/context/workspace";
import type { ConversationKnowledgeRef } from "@/lib/conversation-operator-ai-reasoning";
import { ConversationOperatorAiReasoning } from "./conversation-operator-ai-reasoning";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn().mockResolvedValue({
      links: [
        {
          kind: "context",
          id: "ctx-e5",
          href: "/knowledge?tab=context&contextGroupId=ctx-g1&contextEntryId=ctx-e5",
        },
      ],
    }),
  },
}));

function renderInsight(sources: ConversationKnowledgeRef[]) {
  return render(
    <MemoryRouter initialEntries={["/ws-1/dashboard"]}>
      <Routes>
        <Route
          path="/:workspaceId/*"
          element={
            <WorkspaceProvider>
              <ConversationOperatorAiReasoning
                text="Answered from the workspace context."
                sources={sources}
                alignEnd
              />
            </WorkspaceProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const factRef: ConversationKnowledgeRef = {
  kind: "context",
  label: "Operating Hours",
  groupLabel: "Location & Facilities",
  id: "ctx-e5",
  groupId: "ctx-g1",
};

describe("ConversationOperatorAiReasoning", () => {
  // Operators expand Reasoning to see which knowledge grounded the AI reply, then click
  // through to the exact fact — the link must carry both group and entry so it opens expanded.
  it("links a fact reference to its group and entry in Knowledge", async () => {
    const user = userEvent.setup();
    renderInsight([factRef]);

    expect(screen.getByText("1 ref")).toBeInTheDocument();
    await user.click(screen.getByText("Reasoning"));
    expect(screen.getByText("References")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /Operating Hours/ });
    expect(link).toHaveAttribute(
      "href",
      "/ws-1/knowledge?tab=context&contextGroupId=ctx-g1&contextEntryId=ctx-e5",
    );
  });

  // The chip must name the group as well as the fact so operators know where the text
  // lives before they click.
  it("shows the parent group beside the fact on the chip", async () => {
    const user = userEvent.setup();
    renderInsight([factRef]);

    await user.click(screen.getByText("Reasoning"));
    const link = await screen.findByRole("link", { name: /Operating Hours/ });
    expect(link).toHaveTextContent("Location & Facilities");
    expect(link).toHaveTextContent("Operating Hours");
  });

  // A ref whose item no longer resolves has no href, so it must render as plain text
  // rather than a link that goes nowhere.
  it("renders a ref with no resolvable link as plain text", async () => {
    const user = userEvent.setup();
    renderInsight([{ kind: "skill", label: "Mystery skill" }]);

    await user.click(screen.getByText("Reasoning"));
    expect(screen.getByText("Mystery skill")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mystery skill/ })).not.toBeInTheDocument();
  });
});

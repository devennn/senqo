import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { WorkspaceProvider } from "@/context/workspace";
import { ConversationOperatorAiReasoning } from "./conversation-operator-ai-reasoning";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn().mockResolvedValue({
      links: [
        {
          kind: "context",
          id: "ctx-e1",
          href: "/knowledge?contextGroupId=ctx-g1&contextEntryId=ctx-e1",
        },
      ],
    }),
  },
}));

function renderInsight() {
  return render(
    <MemoryRouter initialEntries={["/ws-1/dashboard"]}>
      <Routes>
        <Route
          path="/:workspaceId/*"
          element={
            <WorkspaceProvider>
              <ConversationOperatorAiReasoning
                text="Used the refund policy."
                sources={[
                  { kind: "context", label: "Refund policy", id: "ctx-e1", groupId: "ctx-g1" },
                ]}
                alignEnd
              />
            </WorkspaceProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConversationOperatorAiReasoning", () => {
  // Operators expand Reasoning to see which knowledge grounded the AI reply, and can open live refs.
  it("links knowledge references that still exist", async () => {
    const user = userEvent.setup();
    renderInsight();

    expect(screen.getByText("1 ref")).toBeInTheDocument();
    await user.click(screen.getByText("Reasoning"));
    expect(screen.getByText("References")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /Refund policy/ });
    expect(link).toHaveAttribute(
      "href",
      "/ws-1/knowledge?contextGroupId=ctx-g1&contextEntryId=ctx-e1",
    );
  });
});

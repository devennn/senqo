import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";
import { AppFrame } from "@/components/layout/app-frame";

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({
  api: { get: mockGet },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "owner@senqo.app" },
    loading: false,
    setUser: vi.fn(),
  }),
}));

function renderFrame() {
  return render(
    <MemoryRouter initialEntries={["/ws-2/dashboard"]}>
      <Routes>
        <Route
          path="/:workspaceId/*"
          element={
            <WorkspaceProvider>
              <AppFrame
                conversations={[]}
                messages={[]}
                hideConversationRail
                mainPanel={<div>Conversation panel</div>}
              />
            </WorkspaceProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppFrame workspace indicator", () => {
  // Brand stays in the mobile header; the nav sheet carries the active workspace row.
  it("shows the current workspace name in the mobile navigation sheet", async () => {
    mockGet.mockResolvedValue({ workspaces: [{ id: "ws-2", name: "Acme Co" }] });

    renderFrame();

    expect(screen.getAllByText("Senqo").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect((await screen.findAllByText("Acme Co")).length).toBeGreaterThan(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";
import { Sidebar } from "@/components/layout/sidebar";

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

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/ws-2/dashboard"]}>
      <Routes>
        <Route
          path="/:workspaceId/*"
          element={
            <WorkspaceProvider>
              <Sidebar />
            </WorkspaceProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({
    workspaces: [{ id: "ws-2", name: "Acme Co" }],
  });
});

describe("Sidebar workspace indicator", () => {
  // Senqo stays the brand at the top; the footer workspace row names the active workspace.
  it("keeps the Senqo brand and shows the current workspace name", async () => {
    renderSidebar();

    expect(await screen.findByText("Acme Co")).toBeInTheDocument();
    expect(screen.getByText("Senqo")).toBeInTheDocument();
  });

  // Collapsed rail keeps a workspace initial visible in the footer workspace row.
  it("shows the workspace initial after collapsing the sidebar", async () => {
    renderSidebar();
    await screen.findByText("Acme Co");

    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.queryByText("Acme Co")).not.toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  // When the workspace list cannot load, the id is a safe non-crashing fallback.
  it("falls back to the workspace id when the name cannot be loaded", async () => {
    mockGet.mockRejectedValue(new Error("network down"));
    renderSidebar();

    expect(await screen.findByText("ws-2")).toBeInTheDocument();
  });
});

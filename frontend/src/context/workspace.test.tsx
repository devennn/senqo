import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "@/context/workspace";

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({
  api: { get: mockGet },
}));

function Probe() {
  const { workspaceName, loadingWorkspaceName, refreshWorkspaceName } = useWorkspace();
  return (
    <div>
      <span data-testid="name">{workspaceName ?? "none"}</span>
      <span data-testid="loading">{loadingWorkspaceName ? "yes" : "no"}</span>
      <button type="button" onClick={() => void refreshWorkspaceName()}>
        Refresh name
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <MemoryRouter initialEntries={["/ws-2/dashboard"]}>
      <Routes>
        <Route
          path="/:workspaceId/*"
          element={
            <WorkspaceProvider>
              <Probe />
            </WorkspaceProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceProvider workspace name", () => {
  // The shell reads the active workspace's name from the user's workspace list.
  it("exposes the name matching the route workspace id", async () => {
    mockGet.mockResolvedValue({
      workspaces: [
        { id: "ws-1", name: "Other Workspace" },
        { id: "ws-2", name: "Acme Co" },
      ],
    });

    renderProbe();

    expect(await screen.findByText("Acme Co")).toBeInTheDocument();
    expect(screen.getByTestId("loading")).toHaveTextContent("no");
  });

  // A failed fetch must not crash the shell; the name is simply unavailable.
  it("leaves the name empty when the workspace list request fails", async () => {
    mockGet.mockRejectedValue(new Error("network down"));

    renderProbe();

    expect(await screen.findByTestId("loading")).toHaveTextContent("no");
    expect(screen.getByTestId("name")).toHaveTextContent("none");
  });

  // Renaming a workspace refreshes the shared name so the shell stays in sync.
  it("picks up a renamed workspace on refresh", async () => {
    mockGet
      .mockResolvedValueOnce({ workspaces: [{ id: "ws-2", name: "Old name" }] })
      .mockResolvedValueOnce({ workspaces: [{ id: "ws-2", name: "New name" }] });

    renderProbe();
    expect(await screen.findByText("Old name")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Refresh name" }));

    expect(await screen.findByText("New name")).toBeInTheDocument();
  });
});

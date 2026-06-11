import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: mockGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const { useConnections } = await import("@/hooks/useConnections");

function wrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/ws-1/channels"]}>
        <Routes>
          <Route path="/:workspaceId/*" element={<WorkspaceProvider>{children}</WorkspaceProvider>} />
        </Routes>
      </MemoryRouter>
    );
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useConnections", () => {
  // Confirms the hook fetches the connections list from the API and exposes them in state.
  // Ensures the channels page can display all WhatsApp/other connections for the workspace.
  it("fetches connection list", async () => {
    mockGet.mockResolvedValue({
      connections: [{ id: "conn-1", display_name: "My WA", agent_config_id: null, mode: "inactive", status: "pending_qr" }],
      events: [],
      canCreateConnection: true,
    });
    const { result } = renderHook(() => useConnections(), { wrapper: wrapper() });
    await act(() => Promise.resolve());
    expect(result.current.connections).toHaveLength(1);
    expect(result.current.connections[0].display_name).toBe("My WA");
  });
});

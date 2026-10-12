import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({
  api: { get: mockGet, post: mockPost, patch: vi.fn(), delete: vi.fn() },
}));

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

  // The test button depends on this: the hook forwards the verified status returned by the check endpoint.
  it("checkConnection returns the verified status from the API", async () => {
    mockGet.mockResolvedValue({ connections: [], events: [], canCreateConnection: true });
    mockPost.mockResolvedValue({ status: "connected" });

    const { result } = renderHook(() => useConnections(), { wrapper: wrapper() });
    await act(() => Promise.resolve());

    let status = "";
    await act(async () => {
      status = await result.current.checkConnection("conn-1");
    });

    expect(status).toBe("connected");
    expect(mockPost).toHaveBeenCalledWith("/api/user/connections/conn-1/check");
  });

  // Failure path: a rejected check must propagate so the button can show its "couldn't reach" message.
  it("checkConnection propagates API failures", async () => {
    mockGet.mockResolvedValue({ connections: [], events: [], canCreateConnection: true });
    mockPost.mockRejectedValue(new Error("HTTP 500"));

    const { result } = renderHook(() => useConnections(), { wrapper: wrapper() });
    await act(() => Promise.resolve());

    await expect(
      act(async () => {
        await result.current.checkConnection("conn-1");
      }),
    ).rejects.toThrow("HTTP 500");
  });
});

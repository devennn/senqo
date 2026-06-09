import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet },
}));

const { useIsWorkspaceOwner } = await import("@/hooks/useIsWorkspaceOwner");

function wrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/ws-1/settings"]}>
        <Routes>
          <Route path="/:workspaceId/*" element={<WorkspaceProvider>{children}</WorkspaceProvider>} />
        </Routes>
      </MemoryRouter>
    );
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useIsWorkspaceOwner", () => {
  it("returns true for owner role", async () => {
    mockGet.mockResolvedValue({ workspace: { role: "owner" } });
    const { result } = renderHook(() => useIsWorkspaceOwner(), { wrapper: wrapper() });
    await act(() => Promise.resolve());
    expect(result.current.isOwner).toBe(true);
  });

  it("returns false for member role", async () => {
    mockGet.mockResolvedValue({ workspace: { role: "member" } });
    const { result } = renderHook(() => useIsWorkspaceOwner(), { wrapper: wrapper() });
    await act(() => Promise.resolve());
    expect(result.current.isOwner).toBe(false);
  });
});

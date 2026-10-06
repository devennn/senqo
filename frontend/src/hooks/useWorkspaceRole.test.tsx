import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({
  api: { get: mockGet },
}));

const { useWorkspaceRole } = await import("@/hooks/useWorkspaceRole");

function wrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/ws-1/settings/team"]}>
        <Routes>
          <Route
            path="/:workspaceId/*"
            element={<WorkspaceProvider>{children}</WorkspaceProvider>}
          />
        </Routes>
      </MemoryRouter>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useWorkspaceRole", () => {
  // Admins need their role exposed so the team page can show role controls.
  it("returns admin for an admin member", async () => {
    mockGet.mockResolvedValue({ workspace: { role: "admin" } });

    const { result } = renderHook(() => useWorkspaceRole(), { wrapper: wrapper() });
    await act(() => Promise.resolve());

    expect(result.current.role).toBe("admin");
    expect(result.current.loading).toBe(false);
  });

  // A failed profile fetch must not grant a role.
  it("returns null when the profile request fails", async () => {
    mockGet.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useWorkspaceRole(), { wrapper: wrapper() });
    await act(() => Promise.resolve());

    expect(result.current.role).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

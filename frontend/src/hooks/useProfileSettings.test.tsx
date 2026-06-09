import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet, put: vi.fn() },
}));

const { useProfileSettings } = await import("@/hooks/useProfileSettings");

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

describe("useProfileSettings", () => {
  it("fetches and returns profile data", async () => {
    mockGet.mockResolvedValue({
      user: { id: "u1", email: "a@b.com", firstName: "John", lastName: "Doe" },
      workspace: { id: "ws-1", name: "My Workspace", role: "owner" },
    });
    const { result } = renderHook(() => useProfileSettings(), { wrapper: wrapper() });
    await act(() => Promise.resolve());
    expect(result.current.bundle).not.toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

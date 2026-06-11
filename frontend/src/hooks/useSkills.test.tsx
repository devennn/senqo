import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { useSkills } = await import("@/hooks/useSkills");

function wrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/ws-1/agent"]}>
        <Routes>
          <Route path="/:workspaceId/*" element={<WorkspaceProvider>{children}</WorkspaceProvider>} />
        </Routes>
      </MemoryRouter>
    );
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useSkills", () => {
  // Confirms the hook fetches the skills list from the API and exposes it in the returned state.
  // Ensures the agent setup page can display available workspace skills.
  it("fetches skills list", async () => {
    mockGet.mockResolvedValue({
      skills: [{ id: "s1", display_name: "My Skill", skill_key: "my_skill", description: "", is_active: true, storage_path: "", created_at: "2025-01-01", updated_at: "2025-01-01" }],
    });
    const { result } = renderHook(
      () => useSkills({ path: "/ws-1/agent", fixedSearchParams: {} }),
      { wrapper: wrapper() },
    );
    await act(() => Promise.resolve());
    expect(result.current.skills).toHaveLength(1);
    expect(result.current.skills[0].display_name).toBe("My Skill");
  });
});

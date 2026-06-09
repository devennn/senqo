import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const { useAgents } = await import("@/hooks/useAgents");

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

describe("useAgents", () => {
  it("fetches agent list on mount and returns data state", async () => {
    mockGet.mockResolvedValueOnce({ agents: [{ id: "a1", profile_name: "Bot", behavior: "", tools: [], skills: [], response_template_groups: [], handoff_topic_groups: [], context_groups: [], asset_groups: [], auto_assign_conversation_labels: false }], agentIdsWithConnection: [], responseTemplateGroups: [], handoffTopicGroups: [], workspaceContextGroups: [], workspaceAssetGroups: [] });
    mockGet.mockResolvedValueOnce({ tools: [] });
    mockGet.mockResolvedValueOnce({ skills: [] });
    mockGet.mockResolvedValueOnce({ connections: [] });

    const { result } = renderHook(() => useAgents(), { wrapper: wrapper() });
    await act(() => Promise.resolve());
    expect(result.current.data.agents).toHaveLength(1);
    expect(result.current.data.agents[0].profile_name).toBe("Bot");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "@/context/workspace";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet },
}));

vi.mock("@/hooks/useRealtime", () => ({
  useRealtime: vi.fn(),
}));

const { useDashboardThread } = await import("@/hooks/useDashboardThread");
const { useRealtime } = await import("@/hooks/useRealtime");

function renderDashboardThreadHook() {
  return renderHook(() => useDashboardThread(null, "", "", false, ""), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={["/ws-1/dashboard"]}>
        <Routes>
          <Route path="/:workspaceId/*" element={<WorkspaceProvider>{children}</WorkspaceProvider>} />
        </Routes>
      </MemoryRouter>
    ),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDashboardThread", () => {
  // Verifies that conversations and labels are fetched from the API on initial render.
  // Ensures the hook triggers both conversation and label endpoints immediately.
  it("fetches conversations on mount", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/user/conversation-labels")) {
        return Promise.resolve({ labels: [] });
      }
      if (url.startsWith("/api/user/conversations")) {
        return Promise.resolve({
          conversations: [
            {
              id: "conv-1",
              contact_name: "Alice",
              last_message_preview: "Hello",
              unread_count: 0,
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    const { result } = renderDashboardThreadHook();

    await act(() => Promise.resolve());

    expect(mockGet).toHaveBeenCalledWith("/api/user/conversation-labels");
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/api/user/conversations"),
    );
  });

  // Confirms that loadingConversations starts as true before any fetch completes.
  // Guarantees the UI can show a loading state immediately on mount.
  it("returns loadingConversations initially as true", () => {
    const { result } = renderDashboardThreadHook();

    expect(result.current.loadingConversations).toBe(true);
  });

  // Ensures loadingConversations is set to false after both API calls resolve.
  // Prevents the UI from showing an infinite loading state when data is available.
  it("sets loadingConversations to false after fetch completes", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/user/conversation-labels")) {
        return Promise.resolve({ labels: [] });
      }
      if (url.startsWith("/api/user/conversations")) {
        return Promise.resolve({ conversations: [] });
      }
      return Promise.resolve({});
    });

    const { result } = renderDashboardThreadHook();

    await act(() => Promise.resolve());

    expect(result.current.loadingConversations).toBe(false);
  });

  // Verifies that the hook subscribes to SSE realtime updates for the current workspace.
  // Critical for live conversation updates without manual page refreshes.
  it("subscribes to realtime updates for the active workspace", () => {
    mockGet.mockResolvedValue({ labels: [], conversations: [] });

    renderDashboardThreadHook();

    expect(useRealtime).toHaveBeenCalledWith("ws-1", expect.any(Function));
  });
});

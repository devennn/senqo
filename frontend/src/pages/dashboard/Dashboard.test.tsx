import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

const mockUseDashboardThread = vi.fn();
vi.mock("@/hooks/useDashboardThread", () => ({
  useDashboardThread: (...args: unknown[]) => mockUseDashboardThread(...args),
}));

vi.mock("@/hooks/useIsWorkspaceOwner", () => ({
  useIsWorkspaceOwner: () => ({ isOwner: true, loading: false }),
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    wsPath: (path: string) => `/ws-1${path}`,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), postForm: vi.fn() },
}));

// The loading-phase logic lives in DashboardPage; render only the main panel
// instead of the full app frame (sidebar, sheets, chat) in jsdom.
vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({ mainPanel }: { mainPanel?: ReactNode }) => <div>{mainPanel}</div>,
}));

const { default: DashboardPage } = await import("@/pages/dashboard/Dashboard");

function buildThreadState(overrides: Record<string, unknown> = {}) {
  return {
    conversations: [],
    labelCatalog: [],
    messages: [],
    loadingConversations: false,
    loadingConversationDetail: false,
    loadingOlderMessages: false,
    hasMoreOlderMessages: false,
    hasMoreConversations: false,
    totalConversations: 0,
    loadingOlderConversations: false,
    loadOlderConversations: vi.fn(),
    activeConversation: null,
    setActiveConversation: vi.fn(),
    setConversations: vi.fn(),
    setMessages: vi.fn(),
    scrollRef: { current: null },
    refreshThreadAndList: vi.fn(),
    newConversationIds: new Set<string>(),
    ...overrides,
  };
}

function renderDashboard(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/:workspaceId/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardPage loading phases", () => {
  // While the chat list bootstraps the main panel says "Loading conversations".
  // Guards the label split so the boot phase keeps its original copy.
  it("shows Loading conversations during the list boot phase", () => {
    mockUseDashboardThread.mockReturnValue(buildThreadState({ loadingConversations: true }));
    renderDashboard("/ws-1/dashboard");
    expect(screen.getByText("Loading conversations")).toBeTruthy();
  });

  // After a conversation is selected, the main panel must say "Loading chat" while
  // the thread detail fetches — previously it repeated "Loading conversations",
  // which read as the list loading twice before the chat appeared.
  it("shows Loading chat while the selected thread detail loads", () => {
    mockUseDashboardThread.mockReturnValue(
      buildThreadState({ loadingConversationDetail: true }),
    );
    renderDashboard("/ws-1/dashboard?conversationId=conv-1");
    expect(screen.getByText("Loading chat")).toBeTruthy();
    expect(screen.queryByText("Loading conversations")).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TasksPage from "@/pages/dashboard/Tasks";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseTasks = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useTasks", () => ({ useTasks: mockUseTasks }));

vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({ mainPanel }: { mainPanel: React.ReactNode }) => <div>{mainPanel}</div>,
}));

vi.mock("@/pages/dashboard/tasks/components/tasks-table", () => ({
  TasksTable: ({ tasks }: { tasks: { id: string }[] }) => (
    <div data-testid="tasks-table">{tasks.length} tasks</div>
  ),
}));

vi.mock("@/pages/dashboard/tasks/components/tasks-toolbar", () => ({
  TasksToolbar: () => <div data-testid="tasks-toolbar" />,
}));

vi.mock("@/pages/dashboard/tasks/components/tasks-flash-banner", () => ({
  TasksFlashBanner: () => null,
}));

vi.mock("@/pages/dashboard/components/table-pagination", () => ({
  TablePagination: () => <div data-testid="pagination" />,
}));

vi.mock("@/pages/dashboard/components/table-list-loading", () => ({
  TableListLoading: () => <div data-testid="loading">Loading tasks</div>,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultHookState(overrides = {}) {
  return {
    tasks: [],
    agents: [],
    total: 0,
    loading: false,
    pageSize: 10,
    createTask: vi.fn(),
    cancelTask: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/ws-1/tasks"]}>
      <TasksPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Tasks page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTasks.mockReturnValue(defaultHookState());
  });

  // Heading renders — confirms correct page.
  it("renders Tasks heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
  });

  // Empty state renders — prevents blank page when no tasks exist.
  it("shows empty state when no tasks", () => {
    renderPage();
    expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument();
  });

  // Tasks table renders when data is present.
  it("renders tasks table when tasks exist", () => {
    mockUseTasks.mockReturnValue(
      defaultHookState({
        tasks: [{ id: "t1", status: "active" }, { id: "t2", status: "completed" }],
        total: 2,
      }),
    );
    renderPage();
    expect(screen.getByTestId("tasks-table")).toBeInTheDocument();
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
  });

  // Loading state shows the loader.
  it("shows loader while loading", () => {
    mockUseTasks.mockReturnValue(defaultHookState({ loading: true }));
    renderPage();
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  // Pagination renders when tasks exist.
  it("renders pagination when tasks exist", () => {
    mockUseTasks.mockReturnValue(
      defaultHookState({ tasks: [{ id: "t1" }], total: 25, pageSize: 10 }),
    );
    renderPage();
    expect(screen.getByTestId("pagination")).toBeInTheDocument();
  });
});

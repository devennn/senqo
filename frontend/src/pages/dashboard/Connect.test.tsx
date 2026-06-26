import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConnectPage from "@/pages/dashboard/Connect";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseConnections = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useConnections", () => ({ useConnections: mockUseConnections }));

vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({ mainPanel }: { mainPanel: React.ReactNode }) => <div>{mainPanel}</div>,
}));

vi.mock("@/pages/dashboard/connect/components/create-connection-dialog", () => ({
  CreateConnectionDialog: () => <button type="button">Connect New</button>,
}));

vi.mock("@/pages/dashboard/connect/components/connection-card", () => ({
  ConnectionCard: ({ connection }: { connection: { id: string; display_name: string } }) => (
    <div data-testid={`connection-${connection.id}`}>{connection.display_name}</div>
  ),
}));

vi.mock("@/pages/dashboard/connect/components/connection-activity-feed", () => ({
  ConnectionActivityFeed: () => null,
}));

vi.mock("@/pages/dashboard/connect/components/connection-unavailable-notice", () => ({
  ConnectionUnavailableNotice: () => <div>Connections unavailable</div>,
}));

vi.mock("@/components/ui/spinner", () => ({
  PageLoader: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultHookState(overrides = {}) {
  return {
    connections: [],
    events: [],
    loading: false,
    canCreateConnection: true,
    connectionUnavailableReason: null,
    createConnection: vi.fn(),
    refreshQr: vi.fn(),
    reconnect: vi.fn(),
    updateMode: vi.fn(),
    updateDisplayName: vi.fn(),
    deleteConnection: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ConnectPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Connect WhatsApp page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConnections.mockReturnValue(defaultHookState());
  });

  // Heading renders — confirms correct page.
  it("renders Connect WhatsApp heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Connect WhatsApp" })).toBeInTheDocument();
  });

  // Loader shows while connections are loading.
  it("shows page loader while loading", () => {
    mockUseConnections.mockReturnValue(defaultHookState({ loading: true }));
    renderPage();
    expect(screen.getByText("Loading connections")).toBeInTheDocument();
  });

  // Connect New button renders when creation is allowed.
  it("renders Connect New button when creation is allowed", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Connect New" })).toBeInTheDocument();
  });

  // Connection cards render for each existing connection.
  it("renders connection cards for existing connections", () => {
    mockUseConnections.mockReturnValue(
      defaultHookState({
        connections: [
          { id: "conn-1", display_name: "My Phone" },
          { id: "conn-2", display_name: "Work Phone" },
        ],
      }),
    );

    renderPage();
    expect(screen.getByText("My Phone")).toBeInTheDocument();
    expect(screen.getByText("Work Phone")).toBeInTheDocument();
  });

  // Empty state renders when no connections exist.
  it("shows empty state when no connections", () => {
    renderPage();
    expect(screen.getByText("No connections")).toBeInTheDocument();
  });
});

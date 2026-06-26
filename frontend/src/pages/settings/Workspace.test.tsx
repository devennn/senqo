import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WorkspacePage from "@/pages/settings/Workspace";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseProfileSettings = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProfileSettings", () => ({
  useProfileSettings: mockUseProfileSettings,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

vi.mock("@/pages/settings/components/profile-settings-cards", () => ({
  ProfileWorkspaceCard: ({ workspace }: { workspace: { name: string } }) => (
    <div data-testid="workspace-card">{workspace.name}</div>
  ),
}));

vi.mock("@/pages/settings/components/workspace-storage-usage-card", () => ({
  WorkspaceStorageUsageCard: () => <div data-testid="storage-card">Storage Card</div>,
}));

vi.mock("@/pages/settings/components/settings-page-loader", () => ({
  SettingsPageLoader: ({ label }: { label: string }) => <div>{label}</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockBundle = {
  profile: { id: "user-1", email: "user@example.com", firstName: "Alice", lastName: "Smith" },
  workspace: { id: "ws-1", name: "Test WS", role: "owner" as const, createdAt: "2026-01-01" },
  storage: { used: 128, limit: 2048 },
};

function defaultHookState(overrides = {}) {
  return {
    bundle: mockBundle,
    loading: false,
    loadError: null,
    reload: vi.fn(),
    saveWorkspaceName: vi.fn(),
    savePersonal: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkspacePage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Workspace settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfileSettings.mockReturnValue(defaultHookState());
  });

  // Page heading renders — confirms correct page.
  it("renders Workspace heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
  });

  // Storage and workspace name cards render when bundle is loaded.
  it("renders storage and workspace name cards", () => {
    renderPage();
    expect(screen.getByTestId("storage-card")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-card")).toBeInTheDocument();
    expect(screen.getByText("Test WS")).toBeInTheDocument();
  });

  // Loader shows while data is loading.
  it("shows loader while loading", () => {
    mockUseProfileSettings.mockReturnValue(defaultHookState({ bundle: null, loading: true }));
    renderPage();
    expect(screen.getByText("Loading workspace")).toBeInTheDocument();
  });

  // Error state shows message and retry button.
  it("shows error message and retry button on load failure", () => {
    mockUseProfileSettings.mockReturnValue(
      defaultHookState({ bundle: null, loading: false, loadError: "load_failed" }),
    );
    renderPage();
    expect(screen.getByText("load failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SecretsPage from "@/pages/settings/Secrets";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseWorkspaceSecrets = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useWorkspaceSecrets", () => ({
  useWorkspaceSecrets: mockUseWorkspaceSecrets,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

vi.mock("@/pages/settings/components/secrets-create-dialog", () => ({
  SecretsCreateDialog: () => <button type="button">Create secret</button>,
}));

vi.mock("@/pages/settings/components/settings-page-loader", () => ({
  SettingsPageLoader: ({ label }: { label: string }) => <div>{label}</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultHookState(overrides = {}) {
  return {
    items: [],
    loading: false,
    loadError: null,
    creating: false,
    deletingId: null,
    createResult: null,
    reload: vi.fn(),
    createSecret: vi.fn(),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
    clearCreateResult: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SecretsPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Secrets settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkspaceSecrets.mockReturnValue(defaultHookState());
  });

  // Page heading and section heading render — verifies page structure.
  it("renders secrets heading and card", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Secrets" })).toBeInTheDocument();
    expect(screen.getByText("Workspace secrets")).toBeInTheDocument();
  });

  // Existing secrets render with their names in the list.
  it("renders existing secrets by name", () => {
    mockUseWorkspaceSecrets.mockReturnValue(
      defaultHookState({
        items: [
          { id: "s1", name: "MY_API_KEY", description: "", value_hint: "abc" },
          { id: "s2", name: "DB_PASSWORD", description: "Database", value_hint: null },
        ],
      }),
    );

    renderPage();
    expect(screen.getByText("MY_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("DB_PASSWORD")).toBeInTheDocument();
  });

  // Empty state shows placeholder text — prevents blank section.
  it("shows empty state when no secrets", () => {
    renderPage();
    expect(screen.getByText("No secrets yet.")).toBeInTheDocument();
  });

  // Loader shows while secrets are loading.
  it("shows loader while loading", () => {
    mockUseWorkspaceSecrets.mockReturnValue(defaultHookState({ loading: true }));
    renderPage();
    expect(screen.getByText("Loading secrets")).toBeInTheDocument();
  });

  // Delete button renders for each secret — verifies delete affordance exists.
  it("renders delete button for each secret", () => {
    mockUseWorkspaceSecrets.mockReturnValue(
      defaultHookState({
        items: [{ id: "s1", name: "KEY_ONE", description: "", value_hint: null }],
      }),
    );

    renderPage();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});

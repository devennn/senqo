import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ApiKeysPage from "@/pages/settings/ApiKeys";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseApiKeys = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useApiKeys", () => ({
  useApiKeys: mockUseApiKeys,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    wsPath: (p: string) => `/ws-1${p}`,
  }),
}));

vi.mock("@/pages/settings/components/api-keys-docs-card", () => ({
  ApiKeysDocsCard: () => <div data-testid="docs-card">How to use API docs</div>,
}));

vi.mock("@/pages/settings/components/api-keys-manager-card", () => ({
  ApiKeysManagerCard: () => (
    <div data-testid="manager-card">API Keys Manager</div>
  ),
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
    revokingId: null,
    createResult: null,
    reload: vi.fn(),
    createKey: vi.fn(),
    deleteKey: vi.fn(),
    clearCreateResult: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ApiKeysPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("API keys settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApiKeys.mockReturnValue(defaultHookState());
  });

  // Both tabs render — verifies tab bar structure.
  it("renders both API settings tabs", () => {
    renderPage();
    expect(
      screen.getByRole("tab", { name: "How to use API" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "API keys" })).toBeInTheDocument();
  });

  // How to use API tab is active by default — users see docs first.
  it("shows How to use API tab as active by default", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "How to use API" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("docs-card")).toBeInTheDocument();
  });

  // Switching to API keys tab shows the management UI.
  it("switches to API keys panel on tab click", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "API keys" }));
    expect(screen.getByRole("tab", { name: "API keys" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("manager-card")).toBeInTheDocument();
  });

  // Loader shows while keys are being fetched.
  it("shows loader while loading", () => {
    mockUseApiKeys.mockReturnValue(defaultHookState({ loading: true }));
    renderPage();
    expect(screen.getByText("Loading API keys")).toBeInTheDocument();
  });

  // Error state shows message and retry button.
  it("shows error message and retry button on load failure", () => {
    mockUseApiKeys.mockReturnValue(
      defaultHookState({ loadError: "load_failed" }),
    );
    renderPage();
    expect(screen.getByText("load failed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});

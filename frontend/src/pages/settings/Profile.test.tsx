import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "@/pages/settings/Profile";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseProfileSettings = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProfileSettings", () => ({
  useProfileSettings: mockUseProfileSettings,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({
    workspaceId: "ws-1",
    wsPath: (p: string) => `/ws-1${p}`,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: { post: vi.fn().mockResolvedValue({ ok: true }) },
}));

vi.mock("@/pages/settings/components/profile-account-cards", () => ({
  ProfilePersonalCard: ({ profile }: { profile: { email: string } }) => (
    <div data-testid="personal-card">{profile.email}</div>
  ),
  ProfilePasswordCard: () => (
    <div data-testid="password-card">Password Card</div>
  ),
}));

vi.mock("@/pages/settings/components/settings-page-loader", () => ({
  SettingsPageLoader: ({ label }: { label: string }) => <div>{label}</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockBundle = {
  profile: {
    id: "user-1",
    email: "user@example.com",
    firstName: "Alice",
    lastName: "Smith",
  },
  workspace: {
    id: "ws-1",
    name: "Test WS",
    role: "owner" as const,
    createdAt: "2026-01-01",
  },
  storage: { used: 0, limit: 1000 },
};

function defaultHookState(overrides = {}) {
  return {
    bundle: mockBundle,
    loading: false,
    loadError: null,
    reload: vi.fn(),
    savePersonal: vi.fn(),
    saveWorkspaceName: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Profile settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfileSettings.mockReturnValue(defaultHookState());
  });

  // Page heading renders — confirms correct page.
  it("renders Profile heading", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "Profile" }),
    ).toBeInTheDocument();
  });

  // Personal info and password cards render when bundle is loaded.
  it("renders personal and password cards when bundle loaded", () => {
    renderPage();
    expect(screen.getByTestId("personal-card")).toBeInTheDocument();
    expect(screen.getByTestId("password-card")).toBeInTheDocument();
  });

  // Loader shows while data is loading — prevents flashing incomplete UI.
  it("shows loader while loading", () => {
    mockUseProfileSettings.mockReturnValue(
      defaultHookState({ bundle: null, loading: true }),
    );
    renderPage();
    expect(screen.getByText("Loading profile")).toBeInTheDocument();
  });

  // Error state shows message and retry button.
  it("shows error message and retry button on load failure", () => {
    mockUseProfileSettings.mockReturnValue(
      defaultHookState({
        bundle: null,
        loading: false,
        loadError: "network_error",
      }),
    );
    renderPage();
    expect(screen.getByText("network error")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import WorkspaceChooserPage from "@/pages/WorkspaceChooser";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/lib/api", () => ({
  api: { get: mockApiGet, post: mockApiPost },
}));

vi.mock("@/lib/auth-client", () => ({ logout: mockLogout }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "user@example.com", isInstanceAdmin: false },
    loading: false,
    setUser: vi.fn(),
  }),
}));

vi.mock("@/components/layout/app-version-footer", () => ({
  AppVersionLabel: () => null,
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkspaceChooserPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorkspaceChooser page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({
      workspaces: [
        { id: "ws-1", name: "Acme Corp", role: "owner" },
        { id: "ws-2", name: "Side Project", role: "member" },
      ],
    });
  });

  // Workspaces load and render — verifies the happy path fetch and render.
  it("renders workspace list from API response", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    expect(screen.getByText("Side Project")).toBeInTheDocument();
    expect(screen.getByText("Workspaces")).toBeInTheDocument();
  });

  // Clicking a workspace navigates to its dashboard.
  it("navigates to workspace dashboard on click", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    await user.click(screen.getByText("Acme Corp"));
    expect(mockNavigate).toHaveBeenCalledWith("/ws-1/dashboard");
  });

  // Search filters workspace list without re-fetching.
  it("filters workspace list by search query", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("Search for a workspace"), "Acme");
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.queryByText("Side Project")).not.toBeInTheDocument();
  });

  // Empty search state shows no-match message.
  it("shows no-match message when search has no results", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("Search for a workspace"), "zzznomatch");
    expect(screen.getByText("No workspaces match your search.")).toBeInTheDocument();
  });

  // Create workspace dialog opens.
  it("opens create workspace dialog on button click", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Create workspace/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  // Create button is disabled until a name is typed — prevents empty workspace creation.
  it("keeps Create button disabled until name is entered", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Create workspace/i }));
    const createBtn = screen.getByRole("button", { name: /^Create$/ });
    expect(createBtn).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "New Project");
    expect(createBtn).not.toBeDisabled();
  });

  // Successful creation navigates to the new workspace dashboard.
  it("creates workspace and navigates to its dashboard", async () => {
    const user = userEvent.setup();
    mockApiPost.mockResolvedValue({ workspaceId: "ws-new" });
    mockApiGet
      .mockResolvedValueOnce({ workspaces: [{ id: "ws-1", name: "Acme Corp", role: "owner" }] })
      .mockResolvedValue({ workspaces: [] });
    renderPage();

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Create workspace/i }));
    await user.type(screen.getByLabelText("Name"), "New Project");
    await user.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/ws-new/dashboard");
    });
  });

  // Sign out calls logout and redirects to sign-in.
  it("sign out button calls logout and navigates to sign-in", async () => {
    const user = userEvent.setup();
    mockLogout.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Sign out/i }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/sign-in");
  });
});

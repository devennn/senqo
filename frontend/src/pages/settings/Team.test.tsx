import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TeamPage from "@/pages/settings/Team";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  api: { get: mockApiGet, post: mockApiPost },
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Team settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ members: [] });
  });

  // All three section cards render — verifies page structure is complete.
  it("renders invite, add, and members sections", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Invite to Senqo")).toBeInTheDocument());
    expect(screen.getByText("Add to workspace")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
  });

  // Members from API response are displayed in the members list.
  it("renders members from API response", async () => {
    mockApiGet.mockResolvedValue({
      members: [
        { id: "m1", email: "alice@example.com", role: "owner" },
        { id: "m2", email: "bob@example.com", role: "member" },
      ],
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("alice@example.com")).toBeInTheDocument());
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  // Empty member list shows placeholder — prevents blank section.
  it("shows empty state when no members", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("No team members yet.")).toBeInTheDocument());
  });

  // Invite form input and submit button are visible.
  it("renders invite email input and send button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Invite to Senqo")).toBeInTheDocument());
    expect(screen.getByLabelText("Email address", { selector: "#inviteEmail" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeInTheDocument();
  });

  // Add-to-workspace form input is visible.
  it("renders add member email input and button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Add to workspace")).toBeInTheDocument());
    expect(screen.getByLabelText("Email address", { selector: "#email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add member" })).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import TeamPage from "@/pages/settings/Team";

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockUseIsWorkspaceOwner = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  api: {
    get: mockGet,
    post: mockPost,
  },
}));

vi.mock("@/hooks/useIsWorkspaceOwner", () => ({
  useIsWorkspaceOwner: mockUseIsWorkspaceOwner,
}));

function renderTeam() {
  return render(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>,
  );
}

describe("Team settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsWorkspaceOwner.mockReturnValue({ isOwner: true, loading: false });
    mockGet.mockResolvedValue({ members: [] });
  });

  // Add-to-workspace form and members list are visible for workspace owners.
  it("renders add member form and members section for owners", async () => {
    renderTeam();
    await waitFor(() => expect(screen.getByText("Add to workspace")).toBeInTheDocument());
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add member" })).toBeInTheDocument();
  });

  // Unregistered email → API returns user_not_found and the page shows a clear message.
  it("shows a clear error when the email has no Senqo account", async () => {
    mockPost.mockRejectedValue(new Error("user_not_found"));
    renderTeam();
    await waitFor(() => expect(screen.getByLabelText("Email address")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Email address"), "unknown@company.com");
    await userEvent.click(screen.getByRole("button", { name: "Add member" }));

    await waitFor(() =>
      expect(
        screen.getByText(/No Senqo account exists for this email/i),
      ).toBeInTheDocument(),
    );
  });

  // Members-only view for non-owners: no add form.
  it("hides add form when the user is not the workspace owner", async () => {
    mockUseIsWorkspaceOwner.mockReturnValue({ isOwner: false, loading: false });
    renderTeam();
    await waitFor(() => expect(screen.getByText("Members")).toBeInTheDocument());
    expect(screen.queryByText("Add to workspace")).not.toBeInTheDocument();
  });
});

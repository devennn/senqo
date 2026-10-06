import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import TeamPage from "@/pages/settings/Team";

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockUseWorkspaceRole = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  api: {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  },
}));

vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: mockUseWorkspaceRole,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuth,
}));

function renderTeam() {
  return render(
    <MemoryRouter>
      <TeamPage />
    </MemoryRouter>,
  );
}

function mockTeamApis(input: {
  members?: unknown[];
  connectionPhones?: Array<string | null>;
  connectionStatus?: string;
} = {}) {
  mockGet.mockImplementation(async (path: string) => {
    if (path.includes("/connections")) {
      return {
        connections: (input.connectionPhones ?? ["15550001111"]).map((phone_number, i) => ({
          id: `conn-${i}`,
          display_name: `Line ${i + 1}`,
          phone_number,
          status: input.connectionStatus ?? "authorized",
          last_state_instance: null,
        })),
      };
    }
    return { members: input.members ?? [] };
  });
}

const ownerBase = {
  id: "user-owner",
  userId: "user-owner",
  email: "owner@senqo.app",
  role: "owner",
  joined_at: "2026-01-01T00:00:00.000Z",
};

describe("Team settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkspaceRole.mockReturnValue({ role: "owner", loading: false });
    mockUseAuth.mockReturnValue({ user: { id: "user-owner", email: "owner@senqo.app" } });
    mockTeamApis();
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
    mockUseWorkspaceRole.mockReturnValue({ role: "member", loading: false });
    renderTeam();
    await waitFor(() => expect(screen.getByText("Members")).toBeInTheDocument());
    expect(screen.queryByText("Add to workspace")).not.toBeInTheDocument();
  });

  // Verified phone summary shows in the row; badge appears after opening the panel.
  it("shows verified phone summary and Verified badge in the handoff panel", async () => {
    mockTeamApis({
      members: [
        {
          ...ownerBase,
          handoffPhones: [
            {
              connectionId: "conn-0",
              connectionName: "Line 1",
              phone: "15551234567",
              status: "verified",
            },
          ],
        },
      ],
    });
    renderTeam();
    await waitFor(() => expect(screen.getByText("+15551234567")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Manage" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  // Send code stays disabled until the phone input is long enough (inside the right panel).
  it("enables Send code only when the handoff phone is valid", async () => {
    mockTeamApis({
      members: [{ ...ownerBase, handoffPhones: [] }],
    });
    renderTeam();
    await userEvent.click(await screen.findByRole("button", { name: "Manage" }));
    const phoneInput = await screen.findByRole("textbox", { name: "Personal number" });
    const sendCode = screen.getByRole("button", { name: "Send code" });
    expect(sendCode).toBeDisabled();
    await userEvent.type(phoneInput, "60123456789");
    expect(sendCode).toBeEnabled();
  });

  // Matching a WhatsApp connection number disables Send code and shows inline guidance.
  it("disables Send code and shows error when phone matches a connected WhatsApp number", async () => {
    mockTeamApis({
      members: [{ ...ownerBase, handoffPhones: [] }],
      connectionPhones: ["+60 12-345 6789"],
    });
    renderTeam();
    await userEvent.click(await screen.findByRole("button", { name: "Manage" }));
    const phoneInput = await screen.findByRole("textbox", { name: "Personal number" });
    await userEvent.type(phoneInput, "60123456789");
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
    expect(screen.getByText(/already used by a WhatsApp connection/i)).toBeInTheDocument();
  });

  // Pending status shows code entry UI in the panel.
  it("shows code field when handoff phone status is pending", async () => {
    mockTeamApis({
      members: [
        {
          ...ownerBase,
          handoffPhones: [
            {
              connectionId: "conn-0",
              connectionName: "Line 1",
              phone: "15551234567",
              status: "pending",
            },
          ],
        },
      ],
    });
    renderTeam();
    await waitFor(() => expect(screen.getByText("Pending confirmation")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Manage" }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  // Non-owner cannot open another member's handoff phone panel.
  it("hides Manage button for non-owners viewing another member", async () => {
    mockUseWorkspaceRole.mockReturnValue({ role: "member", loading: false });
    mockUseAuth.mockReturnValue({ user: { id: "user-self", email: "self@senqo.app" } });
    mockTeamApis({
      members: [
        {
          id: "m2",
          userId: "user-other",
          email: "other@senqo.app",
          role: "member",
          joined_at: "2026-01-01T00:00:00.000Z",
          handoffPhones: [],
        },
      ],
    });
    renderTeam();
    await waitFor(() => expect(screen.getByText("No handoff phone")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
  });

  // The owner can promote a member to admin; the PATCH reaches the API and the list reloads.
  it("lets the owner promote a member to admin", async () => {
    mockPatch.mockResolvedValue({ ok: true });
    mockTeamApis({
      members: [
        {
          id: "m2",
          userId: "user-2",
          email: "bob@senqo.app",
          role: "member",
          joined_at: "2026-01-01T00:00:00.000Z",
          handoffPhones: [],
          receivesErrorAlerts: false,
        },
      ],
    });
    renderTeam();
    await userEvent.click(
      await screen.findByRole("button", { name: "Change role for bob@senqo.app" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "Admin" }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("/api/user/team/role", {
        userId: "user-2",
        role: "admin",
      }),
    );
  });

  // Admins can manage plain members but cannot touch other admins; blocked pickers stay visible but disabled.
  it("shows admins role controls only for plain members", async () => {
    mockUseWorkspaceRole.mockReturnValue({ role: "admin", loading: false });
    mockTeamApis({
      members: [
        {
          id: "m2",
          userId: "user-2",
          email: "bob@senqo.app",
          role: "member",
          joined_at: "2026-01-01T00:00:00.000Z",
          handoffPhones: [],
          receivesErrorAlerts: false,
        },
        {
          id: "m3",
          userId: "user-3",
          email: "carol@senqo.app",
          role: "admin",
          joined_at: "2026-01-02T00:00:00.000Z",
          handoffPhones: [],
          receivesErrorAlerts: false,
        },
      ],
    });
    renderTeam();

    expect(
      await screen.findByRole("button", { name: "Change role for bob@senqo.app" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Change role for carol@senqo.app" }),
    ).toBeDisabled();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  // Plain members can see roles but the picker is greyed out.
  it("disables role controls for members", async () => {
    mockUseWorkspaceRole.mockReturnValue({ role: "member", loading: false });
    mockTeamApis({
      members: [
        {
          id: "m2",
          userId: "user-2",
          email: "bob@senqo.app",
          role: "member",
          joined_at: "2026-01-01T00:00:00.000Z",
          handoffPhones: [],
          receivesErrorAlerts: false,
        },
      ],
    });
    renderTeam();

    await waitFor(() => expect(screen.getByText("Members")).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: "Change role for bob@senqo.app" }),
    ).toBeDisabled();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  // The owner role is fixed and its picker is always greyed out.
  it("disables the role picker for the owner row", async () => {
    mockTeamApis({
      members: [{ ...ownerBase, handoffPhones: [], receivesErrorAlerts: false }],
    });
    renderTeam();

    const ownerRole = await screen.findByRole("button", {
      name: "Change role for owner@senqo.app",
    });
    expect(ownerRole).toBeDisabled();
    expect(ownerRole).toHaveTextContent("Owner");
  });
});

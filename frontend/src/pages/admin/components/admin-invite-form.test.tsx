import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSendAdminRegistrationInvite = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin-api", () => ({
  sendAdminRegistrationInvite: mockSendAdminRegistrationInvite,
}));

import { AdminInviteForm } from "./admin-invite-form";

const INVITE = {
  id: "invite-1",
  email: "invitee@example.com",
  created_at: "2026-10-01T00:00:00.000Z",
  expires_at: "2026-10-08T00:00:00.000Z",
};

const onInvited = vi.fn();

async function submitInvite(email = "invitee@example.com") {
  const user = userEvent.setup();
  render(<AdminInviteForm onInvited={onInvited} />);
  await user.type(screen.getByLabelText("Invite to Senqo"), email);
  await user.click(screen.getByRole("button", { name: "Send invite" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminInviteForm", () => {
  // API reports the invite email could not be delivered → warning shown and input cleared, needed so
  // the operator knows the invitee never received a signup link.
  it("AdminInviteForm → shows delivery warning when emailSent is false", async () => {
    mockSendAdminRegistrationInvite.mockResolvedValue({ emailSent: false, invite: INVITE });

    await submitInvite();

    expect(await screen.findByText(/email could not be sent/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Invite to Senqo")).toHaveValue("");
    expect(mockSendAdminRegistrationInvite).toHaveBeenCalledWith("invitee@example.com");
    expect(onInvited).toHaveBeenCalledWith(INVITE);
  });

  // API reports the invite email was delivered → no warning, input cleared, needed to confirm the
  // success path stays quiet.
  it("AdminInviteForm → shows no warning when emailSent is true", async () => {
    mockSendAdminRegistrationInvite.mockResolvedValue({ emailSent: true, invite: INVITE });

    await submitInvite();

    expect(screen.getByLabelText("Invite to Senqo")).toHaveValue("");
    expect(screen.queryByText(/email could not be sent/i)).not.toBeInTheDocument();
    expect(onInvited).toHaveBeenCalledWith(INVITE);
  });

  // API rejects (e.g. invite already pending) → error message shown and input kept, needed so the
  // operator can retry with a different address without re-typing.
  it("AdminInviteForm → shows the API error and keeps the input when the request fails", async () => {
    mockSendAdminRegistrationInvite.mockRejectedValue(new Error("invite_already_pending"));

    await submitInvite();

    expect(await screen.findByText("invite already pending")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite to Senqo")).toHaveValue("invitee@example.com");
    expect(onInvited).not.toHaveBeenCalled();
  });

  // API rejects because public registration is on → explanatory copy names the cause instead of the
  // raw code, needed so the operator knows to turn the setting off rather than retrying blindly.
  it("AdminInviteForm → explains why invites are unavailable when public registration is enabled", async () => {
    mockSendAdminRegistrationInvite.mockRejectedValue(new Error("public_registration_enabled"));

    await submitInvite();

    expect(await screen.findByText(/Public registration is on/i)).toBeInTheDocument();
    expect(screen.queryByText("public registration enabled")).not.toBeInTheDocument();
  });
});

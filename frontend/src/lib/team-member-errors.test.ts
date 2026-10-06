import { describe, it, expect } from "vitest";
import { teamMemberErrorMessage } from "@/lib/team-member-errors";

describe("teamMemberErrorMessage", () => {
  // Unregistered email error code → user-facing copy explains registration is required.
  it("returns registration guidance for user_not_found", () => {
    expect(teamMemberErrorMessage("user_not_found")).toMatch(/must register/i);
  });

  // Connection-line collision → clear copy so users pick a personal number instead.
  it("returns connection collision guidance for phone_is_connection", () => {
    expect(teamMemberErrorMessage("phone_is_connection")).toMatch(/WhatsApp connection/i);
  });

  // Unsupported role value → the user is told only Member/Admin are valid choices.
  it("returns role choice guidance for invalid_role", () => {
    expect(teamMemberErrorMessage("invalid_role")).toMatch(/Member or Admin/i);
  });

  // The owner role is implicit and never editable.
  it("explains that the owner role cannot be changed", () => {
    expect(teamMemberErrorMessage("cannot_change_owner_role")).toMatch(/owner/i);
  });

  // A target outside the workspace gets a clear not-a-teammate message.
  it("returns a not-a-teammate message for target_not_member", () => {
    expect(teamMemberErrorMessage("target_not_member")).toMatch(/not on this workspace team/i);
  });
});

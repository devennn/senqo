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
});

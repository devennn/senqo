import { describe, it, expect } from "vitest";
import { teamMemberErrorMessage } from "@/lib/team-member-errors";

describe("teamMemberErrorMessage", () => {
  // Unregistered email error code → user-facing copy explains registration is required.
  it("returns registration guidance for user_not_found", () => {
    expect(teamMemberErrorMessage("user_not_found")).toMatch(/must register/i);
  });
});

import { describe, it, expect } from "vitest";
import {
  buildTaskExecuteAgentMessage,
  buildWorkspaceScheduledAgentMessage,
} from "./task-execute-prompt.js";

describe("buildTaskExecuteAgentMessage", () => {
  // Scheduled run must state the time in the task's timezone, not UTC, so the agent
  // reasons about "now" and business hours correctly.
  it("renders the scheduled time in the task timezone", () => {
    const message = buildTaskExecuteAgentMessage(
      "Remind the customer about their booking.",
      "2026-09-25T05:15:00.000Z",
      "Asia/Kuala_Lumpur",
    );

    expect(message).toContain("Friday, September 25, 2026 at 1:15 PM (Asia/Kuala_Lumpur)");
    expect(message).toContain("Remind the customer about their booking.");
  });

  // Tasks without a stored zone default to UTC rather than an invalid formatter input.
  it("defaults to UTC when no timezone is provided", () => {
    const message = buildTaskExecuteAgentMessage("Ping.", "2026-09-25T05:15:00.000Z");
    expect(message).toContain("(UTC)");
  });

  // Invalid zones must not crash task execution; fall back to UTC.
  it("falls back to UTC for an invalid timezone", () => {
    const message = buildTaskExecuteAgentMessage(
      "Ping.",
      "2026-09-25T05:15:00.000Z",
      "Not/AZone",
    );
    expect(message).toContain("(UTC)");
  });
});

describe("buildWorkspaceScheduledAgentMessage", () => {
  // Workspace-level scheduled runs get the same timezone-aware label.
  it("renders the scheduled time in the task timezone", () => {
    const message = buildWorkspaceScheduledAgentMessage(
      "Daily digest.",
      "2026-09-25T05:15:00.000Z",
      "Asia/Kuala_Lumpur",
    );

    expect(message).toContain("Scheduled workspace task:");
    expect(message).toContain("Friday, September 25, 2026 at 1:15 PM (Asia/Kuala_Lumpur)");
  });
});

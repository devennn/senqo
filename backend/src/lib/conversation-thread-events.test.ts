import { describe, it, expect } from "vitest";
import { THREAD_EVENT_HANDOFF_TO_HUMAN, THREAD_EVENT_MANUAL_TOGGLE } from "./conversation-thread-events.js";

describe("THREAD_EVENT_HANDOFF_TO_HUMAN", () => {
  // Ensures the exported constant has the exact string value expected by consumers.
  // Expected: the constant equals the string "handoff_to_human".
  it("is the string 'handoff_to_human'", () => {
    expect(THREAD_EVENT_HANDOFF_TO_HUMAN).toBe("handoff_to_human");
  });
});

describe("THREAD_EVENT_MANUAL_TOGGLE", () => {
  // Ensures the exported constant has the exact string value expected by consumers.
  // Expected: the constant equals the string "manual_toggle_human".
  it("is the string 'manual_toggle_human'", () => {
    expect(THREAD_EVENT_MANUAL_TOGGLE).toBe("manual_toggle_human");
  });
});

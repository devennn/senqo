import { describe, it, expect } from "vitest";
import { THREAD_EVENT_HANDOFF_TO_HUMAN, THREAD_EVENT_MANUAL_TOGGLE } from "./conversation-thread-events.js";

describe("THREAD_EVENT_HANDOFF_TO_HUMAN", () => {
  it("is the string 'handoff_to_human'", () => {
    expect(THREAD_EVENT_HANDOFF_TO_HUMAN).toBe("handoff_to_human");
  });
});

describe("THREAD_EVENT_MANUAL_TOGGLE", () => {
  it("is the string 'manual_toggle_human'", () => {
    expect(THREAD_EVENT_MANUAL_TOGGLE).toBe("manual_toggle_human");
  });
});

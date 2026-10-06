import { describe, it, expect } from "vitest";
import { collectTrailingUserBlockForAi } from "./trailing-user-messages.js";

describe("collectTrailingUserBlockForAi", () => {
  // When an agent error event is the newest row, the pending customer ask before it
  // must still be collected so re-enabling AI processes it instead of noop-ing.
  it("skips a trailing agent error event and keeps the customer ask", () => {
    const result = collectTrailingUserBlockForAi([
      {
        role: "user",
        content: "Are you open tomorrow?",
        created_at: "2026-09-25T05:00:00.000Z",
        metadata: null,
      },
      {
        role: "assistant",
        content: "AI could not reply",
        created_at: "2026-09-25T05:01:00.000Z",
        metadata: {
          thread_event: "agent_error",
          agent_error_message: "OpenRouter request failed",
        },
      },
    ]);

    expect(result.textLines).toEqual(["Are you open tomorrow?"]);
    expect(result.newestUserCreatedAt).toBe("2026-09-25T05:00:00.000Z");
  });

  // A real assistant reply after the customer ask still stops the trailing block,
  // so the error-skip must not leak normal AI replies into the next run.
  it("stops at a normal assistant reply", () => {
    const result = collectTrailingUserBlockForAi([
      {
        role: "user",
        content: "Are you open tomorrow?",
        created_at: "2026-09-25T05:00:00.000Z",
        metadata: null,
      },
      {
        role: "assistant",
        content: "Yes, 9 to 5.",
        created_at: "2026-09-25T05:01:00.000Z",
        metadata: null,
      },
    ]);

    expect(result.textLines).toEqual([]);
  });
});

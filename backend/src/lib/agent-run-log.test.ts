import { describe, it, expect } from "vitest";
import {
  AGENT_RUN_LOG_SOURCE,
  isAgentRunLogProviderOptions,
} from "./agent-run-log.js";

describe("isAgentRunLogProviderOptions", () => {
  // Run logs must not be fed back into the model as conversation history.
  it("detects agent_run_log source", () => {
    expect(
      isAgentRunLogProviderOptions({ source: AGENT_RUN_LOG_SOURCE, kind: "llm_structured_output" }),
    ).toBe(true);
    expect(isAgentRunLogProviderOptions({ source: "outbound_mirror" })).toBe(false);
    expect(isAgentRunLogProviderOptions(null)).toBe(false);
  });
});

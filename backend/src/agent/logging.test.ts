import { describe, it, expect } from "vitest";
import { formatAgentStructuredOutputBlock } from "./logging.js";

describe("formatAgentStructuredOutputBlock", () => {
  // Operators need the full structured LLM output and send count after tool-based send was removed.
  it("includes full LLM output and whatsapp sent count", () => {
    const block = formatAgentStructuredOutputBlock("AgentRuntime", {
      sessionId: "sess-1",
      dryRun: false,
      structuredOutput: {
        messages: [{ text: "Hello", assetFileName: "" }],
        reasoning_for_operators: "Greeting",
        handoff_enabled: false,
      },
      outboundPrepared: [{ text: "Hello" }],
      outboundSent: 1,
    });

    expect(block).toContain("agent_run_result (LLM structured output)");
    expect(block).toContain("whatsapp sent");
    expect(block).toContain("1");
    expect(block).toContain("Hello");
    expect(block).toContain("handoff_enabled");
    expect(block).toContain("Full LLM output");
  });
});

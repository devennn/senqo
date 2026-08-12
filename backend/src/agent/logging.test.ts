import { describe, it, expect } from "vitest";
import {
  formatAgentStructuredOutputBlock,
  summarizeApplyConversationLabelsCalls,
} from "./logging.js";

describe("summarizeApplyConversationLabelsCalls", () => {
  // Verifies the empty case so the final log can show labels were not applied.
  it("returns called=false when the tool was never invoked", () => {
    expect(summarizeApplyConversationLabelsCalls([])).toEqual({
      called: false,
      labelIds: [],
      ok: null,
      appliedCount: null,
      error: null,
    });
  });

  // Uses the last apply_conversation_labels call so replace-style labeling is reflected accurately.
  it("summarizes the last apply_conversation_labels tool result", () => {
    const summary = summarizeApplyConversationLabelsCalls([
      {
        args: { labelIds: ["11111111-1111-1111-1111-111111111111"] },
        output: { ok: true, appliedCount: 1 },
      },
      {
        args: {
          labelIds: [
            "22222222-2222-2222-2222-222222222222",
            "33333333-3333-3333-3333-333333333333",
          ],
        },
        output: { ok: true, appliedCount: 2 },
      },
    ]);

    expect(summary).toEqual({
      called: true,
      labelIds: [
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
      ],
      ok: true,
      appliedCount: 2,
      error: null,
    });
  });

  // Surfaces tool failures so operators can tell labeling was attempted but did not stick.
  it("captures error output when apply_conversation_labels fails", () => {
    const summary = summarizeApplyConversationLabelsCalls([
      {
        args: { labelIds: ["11111111-1111-1111-1111-111111111111"] },
        output: {
          ok: false,
          error: "Auto-assign conversation labels is disabled for this agent.",
        },
      },
    ]);

    expect(summary.called).toBe(true);
    expect(summary.ok).toBe(false);
    expect(summary.error).toBe(
      "Auto-assign conversation labels is disabled for this agent.",
    );
  });
});

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
    expect(block).toContain("labels applied");
    expect(block).toContain("conversation_labels");
  });

  // Confirms operators can see label application status in the final LLM output block.
  it("marks labels applied yes when apply_conversation_labels succeeded", () => {
    const block = formatAgentStructuredOutputBlock("AgentRuntime", {
      sessionId: "sess-1",
      dryRun: false,
      structuredOutput: {
        messages: [],
        reasoning_for_operators: "Labeled VIP",
        handoff_enabled: false,
      },
      outboundPrepared: [],
      outboundSent: 0,
      conversationLabels: {
        called: true,
        labelIds: ["11111111-1111-1111-1111-111111111111"],
        ok: true,
        appliedCount: 1,
        error: null,
      },
    });

    expect(block).toMatch(/labels applied:\s+yes/);
    expect(block).toContain("11111111-1111-1111-1111-111111111111");
    expect(block).toContain('"called": true');
  });
});

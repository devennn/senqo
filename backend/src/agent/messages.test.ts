import { describe, expect, it } from "vitest";
import {
  generateText,
  stepCountIs,
  tool,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import {
  extractGeneratedModelMessages,
  sanitizeAgentHistory,
  stripVolatileHistoryParts,
} from "./messages.js";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/**
 * Stub LanguageModelV3 that runs the real `generateText` tool loop without
 * network access: first turn asks for `ping`, later turns return text.
 */
function createToolThenTextModel(): LanguageModel {
  let callCount = 0;
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-model",
    supportedUrls: {},
    doGenerate: async () => {
      callCount += 1;
      if (callCount === 1) {
        return {
          content: [
            {
              type: "tool-call",
              toolCallId: "toolu_test",
              toolName: "ping",
              input: "{}",
            },
          ],
          finishReason: { unified: "tool-calls", raw: "tool_use" },
          usage,
          warnings: [],
        };
      }
      return {
        content: [{ type: "text", text: "final" }],
        finishReason: { unified: "stop", raw: "end_turn" },
        usage,
        warnings: [],
      };
    },
  } as unknown as LanguageModel;
}

const pingTool = tool({
  description: "ping",
  inputSchema: z.object({}),
  execute: async () => ({ ok: true }),
});

function assistantToolCall(toolCallId: string): ModelMessage {
  return {
    role: "assistant",
    content: [
      { type: "reasoning", text: "thinking" },
      { type: "tool-call", toolCallId, toolName: "ping", input: "{}" },
    ],
  } as ModelMessage;
}

function toolResultMessage(toolCallId: string): ModelMessage {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId,
        toolName: "ping",
        output: { type: "json", value: { ok: true } },
      },
    ],
  } as ModelMessage;
}

function assistantText(text: string): ModelMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
  } as ModelMessage;
}

function userText(text: string): ModelMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
  } as ModelMessage;
}

function countToolParts(
  messages: ModelMessage[],
  type: "tool-call" | "tool-result",
): number {
  return messages
    .flatMap((message) =>
      Array.isArray(message.content) ? message.content : [],
    )
    .filter((part) => (part as { type?: string }).type === type).length;
}

function countReasoningParts(messages: ModelMessage[]): number {
  return messages
    .flatMap((message) =>
      Array.isArray(message.content) ? message.content : [],
    )
    .filter((part) => (part as { type?: string }).type === "reasoning").length;
}

function hasAssistantText(messages: ModelMessage[], text: string): boolean {
  return messages.some(
    (message) =>
      message.role === "assistant" &&
      Array.isArray(message.content) &&
      message.content.some(
        (part) =>
          (part as { type?: string; text?: string }).type === "text" &&
          (part as { text?: string }).text === text,
      ),
  );
}

describe("extractGeneratedModelMessages", () => {
  // AI SDK v6 exposes each step's `response.messages` as a cumulative snapshot.
  // Extraction must return the full run exactly once. Regression: concatenating
  // the step snapshots stored a one-tool-call run as 5 messages and duplicated
  // the tool_result block, which providers reject on the next turn with
  // "each tool_use must have a single result".
  it("extractGeneratedModelMessages → returns each tool call and result once for a two-step run", async () => {
    const result = await generateText({
      model: createToolThenTextModel(),
      tools: { ping: pingTool },
      stopWhen: stepCountIs(5),
      prompt: "hello",
    });

    const extracted = extractGeneratedModelMessages(result);

    expect(extracted.map((message) => message.role)).toEqual([
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(countToolParts(extracted, "tool-call")).toBe(1);
    expect(countToolParts(extracted, "tool-result")).toBe(1);
  });

  // Defensive path: when only step snapshots are exposed, the last snapshot
  // already holds the whole run and must be returned as-is instead of
  // concatenating earlier snapshots.
  it("extractGeneratedModelMessages → falls back to the last step snapshot without concatenating", () => {
    const fabricated = {
      steps: [
        {
          response: {
            messages: [
              assistantToolCall("toolu_test"),
              toolResultMessage("toolu_test"),
            ],
          },
        },
        {
          response: {
            messages: [
              assistantToolCall("toolu_test"),
              toolResultMessage("toolu_test"),
              assistantText("final"),
            ],
          },
        },
      ],
    };

    const extracted = extractGeneratedModelMessages(fabricated);

    expect(extracted).toHaveLength(3);
    expect(countToolParts(extracted, "tool-call")).toBe(1);
    expect(countToolParts(extracted, "tool-result")).toBe(1);
  });
});

describe("sanitizeAgentHistory", () => {
  // Rows written before the extraction fix stored one tool call/result pair
  // twice. Sanitizing must collapse it to a single pair so the next provider
  // call does not see two tool_result blocks for one tool_use id.
  it("sanitizeAgentHistory → collapses a duplicated tool call and result to one pair", () => {
    const id = "toolu_dupe";
    const cleaned = sanitizeAgentHistory([
      assistantToolCall(id),
      toolResultMessage(id),
      assistantToolCall(id),
      toolResultMessage(id),
      assistantText("done"),
    ]);

    expect(countToolParts(cleaned, "tool-call")).toBe(1);
    expect(countToolParts(cleaned, "tool-result")).toBe(1);
    expect(hasAssistantText(cleaned, "done")).toBe(true);
  });

  // Rows from one insert share a timestamp, so reads can return the result
  // before its call. The call is then pruned (no result after it) and the
  // orphaned result must be dropped too or the provider rejects the pairing.
  it("sanitizeAgentHistory → drops a result whose call was pruned", () => {
    const cleaned = sanitizeAgentHistory([
      toolResultMessage("toolu_orphan"),
      assistantToolCall("toolu_orphan"),
      userText("hi"),
    ]);

    expect(countToolParts(cleaned, "tool-call")).toBe(0);
    expect(countToolParts(cleaned, "tool-result")).toBe(0);
    expect(cleaned.map((message) => message.role)).toEqual(["user"]);
  });

  // A tool call without any stored result cannot be replayed; sanitizing must
  // drop it so the provider never sees an unresolved tool_use.
  it("sanitizeAgentHistory → drops a tool call that has no result", () => {
    const cleaned = sanitizeAgentHistory([
      assistantToolCall("toolu_missing"),
      userText("hi"),
    ]);

    expect(countToolParts(cleaned, "tool-call")).toBe(0);
    expect(cleaned.map((message) => message.role)).toEqual(["user"]);
  });

  // Healthy histories must pass through untouched so normal tool turns keep
  // their exchange with the model.
  it("sanitizeAgentHistory → keeps a valid tool exchange intact", () => {
    const id = "toolu_ok";
    const cleaned = sanitizeAgentHistory([
      userText("hi"),
      assistantToolCall(id),
      toolResultMessage(id),
      assistantText("done"),
    ]);

    expect(cleaned.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(countToolParts(cleaned, "tool-call")).toBe(1);
    expect(countToolParts(cleaned, "tool-result")).toBe(1);
  });

  // Providers such as Azure Anthropic bind thinking-block signatures to the
  // system prompt of the run that produced them; this runtime rebuilds the
  // prompt per run (timestamps, catalog), so replayed reasoning parts must be
  // stripped or the next run fails with "Invalid `signature` in `thinking` block".
  it("sanitizeAgentHistory → strips reasoning parts from replayed history", () => {
    const id = "toolu_think";
    const cleaned = sanitizeAgentHistory([
      userText("hi"),
      assistantToolCall(id),
      toolResultMessage(id),
      assistantText("done"),
    ]);

    expect(countReasoningParts(cleaned)).toBe(0);
    expect(countToolParts(cleaned, "tool-call")).toBe(1);
    expect(countToolParts(cleaned, "tool-result")).toBe(1);
    expect(hasAssistantText(cleaned, "done")).toBe(true);
  });

  // An assistant turn that only carries a thinking block has nothing left after
  // the strip; the empty message must be dropped so the provider never sees a
  // content-less turn.
  it("sanitizeAgentHistory → drops an assistant message left empty by the strip", () => {
    const cleaned = sanitizeAgentHistory([
      userText("hi"),
      {
        role: "assistant",
        content: [{ type: "reasoning", text: "thinking" }],
      } as ModelMessage,
      userText("again"),
    ]);

    expect(cleaned.map((message) => message.role)).toEqual(["user", "user"]);
  });
});

describe("stripVolatileHistoryParts", () => {
  // Last-resort scrub before a retry: parts keep their payloads but lose
  // provider options (signatures, cache hints) that were bound to an older request.
  it("stripVolatileHistoryParts → drops provider options from replayable parts", () => {
    const cleaned = stripVolatileHistoryParts([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "hi",
            providerOptions: { anthropic: { signature: "stale" } },
          },
        ],
      } as ModelMessage,
      {
        role: "user",
        content: [
          { type: "text", text: "yo", providerOptions: { cacheControl: true } },
        ],
      } as ModelMessage,
    ]);

    expect(cleaned[0]?.content).toEqual([{ type: "text", text: "hi" }]);
    expect(cleaned[1]?.content).toEqual([{ type: "text", text: "yo" }]);
  });

  // Volatile or unknown part types (reasoning blocks, provider extras) are what
  // the provider already rejected once, so the retry request must not include them.
  it("stripVolatileHistoryParts → drops volatile and unknown part types", () => {
    const cleaned = stripVolatileHistoryParts([
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "thinking" },
          { type: "provider_signature", value: "x" },
          { type: "text", text: "kept" },
        ],
      } as unknown as ModelMessage,
    ]);

    expect(cleaned[0]?.content).toEqual([{ type: "text", text: "kept" }]);
  });

  // A message that only carried volatile parts has nothing left to replay; it
  // must be removed so the provider never sees an empty turn.
  it("stripVolatileHistoryParts → removes messages left empty", () => {
    const cleaned = stripVolatileHistoryParts([
      userText("hi"),
      {
        role: "assistant",
        content: [{ type: "reasoning", text: "thinking" }],
      } as ModelMessage,
    ]);

    expect(cleaned.map((message) => message.role)).toEqual(["user"]);
  });
});

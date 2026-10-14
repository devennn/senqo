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
  sanitizeToolCallHistory,
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

describe("sanitizeToolCallHistory", () => {
  // Rows written before the extraction fix stored one tool call/result pair
  // twice. Sanitizing must collapse it to a single pair so the next provider
  // call does not see two tool_result blocks for one tool_use id.
  it("sanitizeToolCallHistory → collapses a duplicated tool call and result to one pair", () => {
    const id = "toolu_dupe";
    const cleaned = sanitizeToolCallHistory([
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
  it("sanitizeToolCallHistory → drops a result whose call was pruned", () => {
    const cleaned = sanitizeToolCallHistory([
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
  it("sanitizeToolCallHistory → drops a tool call that has no result", () => {
    const cleaned = sanitizeToolCallHistory([
      assistantToolCall("toolu_missing"),
      userText("hi"),
    ]);

    expect(countToolParts(cleaned, "tool-call")).toBe(0);
    expect(cleaned.map((message) => message.role)).toEqual(["user"]);
  });

  // Healthy histories must pass through untouched so normal tool turns keep
  // their exchange with the model.
  it("sanitizeToolCallHistory → keeps a valid tool exchange intact", () => {
    const id = "toolu_ok";
    const cleaned = sanitizeToolCallHistory([
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
});

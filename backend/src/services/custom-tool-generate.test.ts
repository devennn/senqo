import { describe, it, expect, vi, beforeEach } from "vitest";

const generateTextMock = vi.fn();
const compileCustomToolSourceMock = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  Output: {
    object: (opts: unknown) => opts,
  },
}));

vi.mock("../agent/llm.js", () => ({
  getChatLLM: vi.fn(() => "mock-chat-model"),
}));

vi.mock("./custom-tool-compile.js", () => ({
  compileCustomToolSource: (...args: unknown[]) => compileCustomToolSourceMock(...args),
}));

import {
  CUSTOM_TOOL_GENERATE_PROMPT_MAX_CHARS,
  generateCustomToolDraft,
} from "./custom-tool-generate.js";

const VALID_SOURCE = `export async function execute(
  input: { city: string },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  return { ok: true, city: input.city, key: ctx.env.API_KEY };
}
`;

describe("generateCustomToolDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Empty prompt must fail before calling the LLM so we do not waste model tokens.
  it("returns error when prompt is empty", async () => {
    const result = await generateCustomToolDraft("   ");
    expect(result).toEqual({ ok: false, message: "Reference text is required." });
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  // Oversized prompts are rejected with a clear limit message.
  it("returns error when prompt exceeds max length", async () => {
    const result = await generateCustomToolDraft("x".repeat(CUSTOM_TOOL_GENERATE_PROMPT_MAX_CHARS + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain(String(CUSTOM_TOOL_GENERATE_PROMPT_MAX_CHARS));
    }
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  // Happy path: LLM draft is compiled and returned with normalized source/env.
  it("returns compiled draft from LLM output", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        displayName: " City Weather ",
        description: " Look up weather ",
        requiredEnv: [" API_KEY ", ""],
        sourceCode: VALID_SOURCE,
      },
    });
    compileCustomToolSourceMock.mockResolvedValue({
      ok: true,
      metadata: {
        normalizedSource: VALID_SOURCE.trim(),
        requiredEnv: ["API_KEY"],
        inputSchema: {},
        sourceHash: "abc",
      },
    });

    const result = await generateCustomToolDraft("GET /weather?q=city");
    expect(result).toEqual({
      ok: true,
      draft: {
        displayName: "City Weather",
        description: "Look up weather",
        requiredEnv: ["API_KEY"],
        sourceCode: VALID_SOURCE.trim(),
      },
    });
    expect(compileCustomToolSourceMock).toHaveBeenCalledWith(VALID_SOURCE, {
      requiredEnv: ["API_KEY"],
    });
  });

  // Invalid generated code must not be returned to the client as a usable draft.
  it("returns error when generated source fails compile", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        displayName: "Bad Tool",
        description: "broken",
        requiredEnv: [],
        sourceCode: "not valid",
      },
    });
    compileCustomToolSourceMock.mockResolvedValue({
      ok: false,
      error: "Module must export async function execute.",
    });

    const result = await generateCustomToolDraft("make a tool");
    expect(result).toEqual({
      ok: false,
      message: "Generated code was invalid. Adjust the reference and try again.",
    });
  });

  // LLM/provider failures surface as a generic generate failure message.
  it("returns error when generateText throws", async () => {
    generateTextMock.mockRejectedValue(new Error("provider down"));
    const result = await generateCustomToolDraft("anything");
    expect(result).toEqual({ ok: false, message: "Could not generate tool code." });
  });
});

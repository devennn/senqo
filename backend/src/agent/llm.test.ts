import { beforeEach, describe, expect, it, vi } from "vitest";

const openrouterChatMock = vi.fn((modelId: string) => ({
  provider: "openrouter",
  modelId,
}));
const openaiChatMock = vi.fn((modelId: string) => ({
  provider: "openai",
  modelId,
}));

const createOpenRouterMock = vi.fn(() => ({
  chat: openrouterChatMock,
}));
const createOpenAIMock = vi.fn(() => ({
  chat: openaiChatMock,
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: createOpenRouterMock,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAIMock,
}));

const envState = {
  modelProvider: "openrouter" as "openrouter" | "openai",
  openRouterApiKey: "sk-or-test",
  openaiApiKey: "sk-test",
  chatLLM: "openai/gpt-4.1",
  formatterLLM: "x-ai/grok-4.1-fast",
};

vi.mock("../lib/env.js", () => ({
  env: envState,
}));

async function loadLlmModule() {
  return import("./llm.js");
}

describe("getChatLLM", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    envState.modelProvider = "openrouter";
    envState.chatLLM = "openai/gpt-4.1";
    envState.formatterLLM = "x-ai/grok-4.1-fast";
    await loadLlmModule();
  });

  // Chat model resolution should use the configured OpenRouter model id.
  // Expected: returns an OpenRouter chat model bound to env.chatLLM.
  it("returns the OpenRouter chat model for the configured chat id", async () => {
    const { getChatLLM } = await loadLlmModule();
    const model = getChatLLM();

    expect(createOpenRouterMock).toHaveBeenCalledWith({
      apiKey: "sk-or-test",
    });
    expect(openrouterChatMock).toHaveBeenCalledWith("openai/gpt-4.1");
    expect(model).toEqual({
      provider: "openrouter",
      modelId: "openai/gpt-4.1",
    });
  });

  // OpenAI provider selection should route through createOpenAI with the OpenAI key.
  // Expected: returns an OpenAI chat model bound to env.chatLLM.
  it("returns the OpenAI chat model when MODEL_PROVIDER is openai", async () => {
    envState.modelProvider = "openai";
    envState.chatLLM = "gpt-4.1";
    const { getChatLLM } = await loadLlmModule();
    const model = getChatLLM();

    expect(createOpenAIMock).toHaveBeenCalledWith({ apiKey: "sk-test" });
    expect(openaiChatMock).toHaveBeenCalledWith("gpt-4.1");
    expect(model).toEqual({ provider: "openai", modelId: "gpt-4.1" });
  });

  // Provider clients should be reused across repeated lookups in one process.
  // Expected: createOpenRouter is called once for multiple getChatLLM calls.
  it("reuses the cached provider between chat lookups", async () => {
    const { getChatLLM } = await loadLlmModule();

    getChatLLM();
    getChatLLM();

    expect(createOpenRouterMock).toHaveBeenCalledTimes(1);
    expect(openrouterChatMock).toHaveBeenCalledTimes(2);
  });
});

describe("getFormatterLLM", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    envState.modelProvider = "openrouter";
    envState.chatLLM = "openai/gpt-4.1";
    envState.formatterLLM = "x-ai/grok-4.1-fast";
    await loadLlmModule();
  });

  // Formatter resolution should use the formatter env var, not the chat model id.
  // Expected: OpenRouter chat is invoked with env.formatterLLM.
  it("returns the formatter model id from env.formatterLLM", async () => {
    const { getFormatterLLM } = await loadLlmModule();
    const model = getFormatterLLM();

    expect(openrouterChatMock).toHaveBeenCalledWith("x-ai/grok-4.1-fast");
    expect(model).toEqual({
      provider: "openrouter",
      modelId: "x-ai/grok-4.1-fast",
    });
  });
});

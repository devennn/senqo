import { describe, expect, it } from "vitest";
import {
  loadModelEnv,
  requireTrimmedEnv,
  validateActiveModelEnv,
} from "./model-env.js";

describe("requireTrimmedEnv", () => {
  // Whitespace-only values should be treated as missing configuration.
  // Expected: throws with the env var name so operators know what to set.
  it("throws when the env value is blank after trim", () => {
    expect(() =>
      requireTrimmedEnv("OPENROUTER_CHAT_LLM", { OPENROUTER_CHAT_LLM: "   " }),
    ).toThrow("Required environment variable OPENROUTER_CHAT_LLM is not set");
  });

  // Surrounding whitespace should be stripped from valid values.
  // Expected: returns the trimmed model id used by the LLM resolver.
  it("returns trimmed env values", () => {
    expect(
      requireTrimmedEnv("OPENAI_CHAT_LLM", { OPENAI_CHAT_LLM: " gpt-4.1 " }),
    ).toBe("gpt-4.1");
  });
});

describe("loadModelEnv", () => {
  const openrouterEnv = {
    OPENROUTER_API_KEY: "sk-or-test",
    OPENROUTER_CHAT_LLM: "openai/gpt-4.1",
    OPENROUTER_FORMATTER_LLM: "x-ai/grok-4.1-fast",
  };

  const openaiEnv = {
    OPENAI_API_KEY: "sk-test",
    OPENAI_CHAT_LLM: "gpt-4.1",
    OPENAI_FORMATTER_LLM: "gpt-4.1-nano-2025-04-14",
  };

  // OpenRouter deployments should load only OpenRouter credentials and model ids.
  // Expected: chat and formatter ids come from OPENROUTER_* vars.
  it("loads OpenRouter chat and formatter models", () => {
    expect(loadModelEnv("openrouter", openrouterEnv)).toEqual({
      modelProvider: "openrouter",
      openRouterApiKey: "sk-or-test",
      chatLLM: "openai/gpt-4.1",
      formatterLLM: "x-ai/grok-4.1-fast",
    });
  });

  // OpenAI deployments should load only OpenAI credentials and model ids.
  // Expected: chat and formatter ids come from OPENAI_* vars.
  it("loads OpenAI chat and formatter models", () => {
    expect(loadModelEnv("openai", openaiEnv)).toEqual({
      modelProvider: "openai",
      openaiApiKey: "sk-test",
      chatLLM: "gpt-4.1",
      formatterLLM: "gpt-4.1-nano-2025-04-14",
    });
  });

  // Missing provider-specific keys should fail before the server handles traffic.
  // Expected: throws naming the missing OpenRouter env var.
  it("throws when an OpenRouter model env var is missing", () => {
    expect(() =>
      loadModelEnv("openrouter", {
        OPENROUTER_API_KEY: "sk-or-test",
        OPENROUTER_CHAT_LLM: "openai/gpt-4.1",
      }),
    ).toThrow(
      "Required environment variable OPENROUTER_FORMATTER_LLM is not set (required when MODEL_PROVIDER=openrouter)",
    );
  });
});

describe("validateActiveModelEnv", () => {
  const openrouterEnv = {
    MODEL_PROVIDER: "openrouter",
    OPENROUTER_API_KEY: "sk-or-test",
    OPENROUTER_CHAT_LLM: "openai/gpt-4.1",
    OPENROUTER_FORMATTER_LLM: "x-ai/grok-4.1-fast",
  };

  const openaiEnv = {
    MODEL_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    OPENAI_CHAT_LLM: "gpt-4.1",
    OPENAI_FORMATTER_LLM: "gpt-4.1-nano-2025-04-14",
  };

  // Active provider selection should gate which env block must be present.
  // Expected: OpenAI vars are required when MODEL_PROVIDER=openai, not OpenRouter vars.
  it("requires OpenAI vars when MODEL_PROVIDER is openai", () => {
    expect(validateActiveModelEnv(openaiEnv)).toBe("openai");
  });

  // OpenRouter deployments should validate the OpenRouter env block only.
  // Expected: returns openrouter when OPENROUTER_* vars are set.
  it("requires OpenRouter vars when MODEL_PROVIDER is openrouter", () => {
    expect(validateActiveModelEnv(openrouterEnv)).toBe("openrouter");
  });

  // Missing OpenAI credentials should fail with provider-specific guidance.
  // Expected: error names OPENAI_API_KEY and MODEL_PROVIDER=openai.
  it("throws when OpenAI vars are missing for MODEL_PROVIDER=openai", () => {
    expect(() =>
      validateActiveModelEnv({ MODEL_PROVIDER: "openai" }),
    ).toThrow(
      "Required environment variable OPENAI_API_KEY is not set (required when MODEL_PROVIDER=openai)",
    );
  });
});

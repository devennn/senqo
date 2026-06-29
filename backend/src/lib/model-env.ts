import type { ModelProvider } from "./model-provider.js";

export function requireTrimmedEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export function loadModelEnv(
  modelProvider: ModelProvider,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (modelProvider === "openrouter") {
    return {
      modelProvider,
      openRouterApiKey: requireTrimmedEnv("OPENROUTER_API_KEY", env),
      chatLLM: requireTrimmedEnv("OPENROUTER_CHAT_LLM", env),
      formatterLLM: requireTrimmedEnv("OPENROUTER_FORMATTER_LLM", env),
    };
  }

  return {
    modelProvider,
    openaiApiKey: requireTrimmedEnv("OPENAI_API_KEY", env),
    chatLLM: requireTrimmedEnv("OPENAI_CHAT_LLM", env),
    formatterLLM: requireTrimmedEnv("OPENAI_FORMATTER_LLM", env),
  };
}

import type { ModelProvider } from "./model-provider.js";
import { parseModelProvider } from "./model-provider.js";

export function requireTrimmedEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  modelProvider?: ModelProvider,
): string {
  const value = env[name]?.trim();
  if (!value) {
    const suffix = modelProvider
      ? ` (required when MODEL_PROVIDER=${modelProvider})`
      : "";
    throw new Error(`Required environment variable ${name} is not set${suffix}`);
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
      openRouterApiKey: requireTrimmedEnv(
        "OPENROUTER_API_KEY",
        env,
        modelProvider,
      ),
      chatLLM: requireTrimmedEnv("OPENROUTER_CHAT_LLM", env, modelProvider),
      formatterLLM: requireTrimmedEnv(
        "OPENROUTER_FORMATTER_LLM",
        env,
        modelProvider,
      ),
    };
  }

  return {
    modelProvider,
    openaiApiKey: requireTrimmedEnv("OPENAI_API_KEY", env, modelProvider),
    chatLLM: requireTrimmedEnv("OPENAI_CHAT_LLM", env, modelProvider),
    formatterLLM: requireTrimmedEnv("OPENAI_FORMATTER_LLM", env, modelProvider),
  };
}

export function validateActiveModelEnv(
  env: NodeJS.ProcessEnv = process.env,
): ModelProvider {
  const rawProvider = env.MODEL_PROVIDER?.trim();
  if (!rawProvider) {
    throw new Error("Required environment variable MODEL_PROVIDER is not set");
  }

  const modelProvider = parseModelProvider(rawProvider);
  loadModelEnv(modelProvider, env);
  return modelProvider;
}

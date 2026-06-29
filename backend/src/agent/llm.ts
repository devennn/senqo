import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { env, type ModelProvider } from "../lib/env.js";

type ChatProvider = ReturnType<typeof createOpenRouter | typeof createOpenAI>;

let cachedModelProvider: ModelProvider | null = null;
let cachedProvider: ChatProvider | null = null;

function createProvider(): ChatProvider {
  switch (env.modelProvider) {
    case "openrouter":
      return createOpenRouter({
        apiKey: env.openRouterApiKey,
      });
    case "openai":
      return createOpenAI({
        apiKey: env.openaiApiKey,
      });
  }
}

function getProvider(): ChatProvider {
  if (cachedProvider && cachedModelProvider === env.modelProvider) {
    return cachedProvider;
  }

  cachedProvider = createProvider();
  cachedModelProvider = env.modelProvider;
  return cachedProvider;
}

export function getChatLLM(): LanguageModelV3 {
  return getProvider().chat(env.chatLLM);
}

export function getFormatterLLM(): LanguageModelV3 {
  return getProvider().chat(env.formatterLLM);
}

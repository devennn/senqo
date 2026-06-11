import { describe, it, expect } from "vitest";
import {
  DEFAULT_TOOL_KEYS,
  resolveEnabledToolKeys,
  buildAgentSystemPrompt,
} from "./system-prompt.js";

describe("DEFAULT_TOOL_KEYS", () => {
  // Verifies the default tool set contains all essential agent capabilities.
  // Expected: the array includes create_task, load_skills, send_whatsapp_message, handoff_to_human, apply_conversation_labels.
  it("includes all required default tools", () => {
    expect(DEFAULT_TOOL_KEYS).toContain("create_task");
    expect(DEFAULT_TOOL_KEYS).toContain("load_skills");
    expect(DEFAULT_TOOL_KEYS).toContain("send_whatsapp_message");
    expect(DEFAULT_TOOL_KEYS).toContain("handoff_to_human");
    expect(DEFAULT_TOOL_KEYS).toContain("apply_conversation_labels");
  });
});

describe("resolveEnabledToolKeys", () => {
  // Merges default and config-provided tools without duplicates.
  // Expected: output contains both default and extra keys; duplicates appear only once.
  it("returns default tools plus config tools, deduplicated", () => {
    const result = resolveEnabledToolKeys(["get_weather", "create_task"]);
    expect(result).toContain("create_task");
    expect(result).toContain("get_weather");
    expect(result).toContain("load_skills");
    expect(result).toContain("send_whatsapp_message");
    // create_task appears only once (already in defaults)
    expect(result.filter((k) => k === "create_task")).toHaveLength(1);
  });

  // When configTools is undefined, only the default tool keys should be returned.
  // Expected: result equals DEFAULT_TOOL_KEYS.
  it("returns only defaults when configTools is undefined", () => {
    const result = resolveEnabledToolKeys(undefined);
    expect(result).toEqual([...DEFAULT_TOOL_KEYS]);
  });

  // When configTools is an empty array, only the default tool keys should be returned.
  // Expected: result equals DEFAULT_TOOL_KEYS.
  it("returns only defaults when configTools is empty array", () => {
    const result = resolveEnabledToolKeys([]);
    expect(result).toEqual([...DEFAULT_TOOL_KEYS]);
  });
});

const baseInput = {
  dryRun: false,
  enabledToolKeys: [...DEFAULT_TOOL_KEYS],
  customToolDescriptions: {},
  workspaceContext: "We sell widgets.",
  responseTemplates: "Q: Returns? A: 30 days.",
  handoffTopics: "Billing, Complaints",
  conversationLabels: "VIP, New Lead",
  assetGroups: [],
  profileName: "WidgetBot",
  behavior: "Be helpful and concise.",
};

describe("buildAgentSystemPrompt", () => {
  // Assembles all configuration sections into a single system prompt string.
  // Expected: prompt contains profile name, behavior, context, templates, handoff topics, and labels.
  it("merges behaviour, response templates, context groups, handoff topics, and skills", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("WidgetBot");
    expect(prompt).toContain("Be helpful and concise.");
    expect(prompt).toContain("We sell widgets.");
    expect(prompt).toContain("Q: Returns? A: 30 days.");
    expect(prompt).toContain("Billing, Complaints");
    expect(prompt).toContain("VIP, New Lead");
  });

  // When dryRun is true, the prompt must instruct the agent not to send real WhatsApp messages.
  // Expected: dry-run rule is present; live message rule is absent.
  it("includes dry-run WhatsApp rule when dryRun is true", () => {
    const prompt = buildAgentSystemPrompt({ ...baseInput, dryRun: true });
    expect(prompt).toContain(
      "Do not call `send_whatsapp_message`. Return draft text only.",
    );
    expect(prompt).not.toContain(
      "This is a WhatsApp conversation. Call `send_whatsapp_message` with the final message text.",
    );
  });

  // When dryRun is false, the prompt must instruct the agent to send live WhatsApp messages.
  // Expected: live message rule is present; dry-run rule is absent.
  it("includes live WhatsApp rule when dryRun is false", () => {
    const prompt = buildAgentSystemPrompt({ ...baseInput, dryRun: false });
    expect(prompt).toContain(
      "This is a WhatsApp conversation. Call `send_whatsapp_message` with the final message text.",
    );
    expect(prompt).not.toContain(
      "Do not call `send_whatsapp_message`. Return draft text only.",
    );
  });

  // When no asset groups are configured, the prompt should indicate that clearly.
  // Expected: prompt contains "(none configured for this agent)".
  it('shows "(none configured)" for empty asset groups', () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("(none configured for this agent)");
  });

  // The available tools section lists enabled tool keys with their descriptions.
  // Expected: prompt lists the tool keys and the custom tool description.
  it("includes available tools section with all enabled tool keys", () => {
    const prompt = buildAgentSystemPrompt({
      ...baseInput,
      enabledToolKeys: ["create_task", "get_weather"],
      customToolDescriptions: { get_weather: "Look up weather for a city." },
    });
    expect(prompt).toContain("`create_task`");
    expect(prompt).toContain("`get_weather`");
    expect(prompt).toContain("Look up weather for a city.");
  });
});

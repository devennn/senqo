import { describe, it, expect } from "vitest";
import {
  DEFAULT_TOOL_KEYS,
  resolveEnabledToolKeys,
  buildAgentSystemPrompt,
} from "./system-prompt.js";

describe("DEFAULT_TOOL_KEYS", () => {
  // Default builtins no longer include a WhatsApp send tool.
  it("includes required default tools without send_whatsapp_message", () => {
    expect(DEFAULT_TOOL_KEYS).toContain("create_task");
    expect(DEFAULT_TOOL_KEYS).toContain("load_skills");
    expect(DEFAULT_TOOL_KEYS).toContain("handoff_to_human");
    expect(DEFAULT_TOOL_KEYS).toContain("apply_conversation_labels");
    expect(DEFAULT_TOOL_KEYS).not.toContain("send_whatsapp_message");
  });
});

describe("resolveEnabledToolKeys", () => {
  // Merges default and config-provided tools without duplicates.
  it("returns default tools plus config tools, deduplicated", () => {
    const result = resolveEnabledToolKeys(["get_weather", "create_task"]);
    expect(result).toContain("create_task");
    expect(result).toContain("get_weather");
    expect(result).toContain("load_skills");
    expect(result).not.toContain("send_whatsapp_message");
    expect(result.filter((k) => k === "create_task")).toHaveLength(1);
  });

  // When configTools is undefined, only the default tool keys should be returned.
  it("returns only defaults when configTools is undefined", () => {
    const result = resolveEnabledToolKeys(undefined);
    expect(result).toEqual([...DEFAULT_TOOL_KEYS]);
  });

  // When configTools is an empty array, only the default tool keys should be returned.
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
  it("merges behaviour, response templates, context groups, handoff topics, and labels", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("WidgetBot");
    expect(prompt).toContain("Be helpful and concise.");
    expect(prompt).toContain("We sell widgets.");
    expect(prompt).toContain("Q: Returns? A: 30 days.");
    expect(prompt).toContain("Billing, Complaints");
    expect(prompt).toContain("VIP, New Lead");
  });

  // Dry-run drafts messages without sending.
  it("includes dry-run messages rule when dryRun is true", () => {
    const prompt = buildAgentSystemPrompt({ ...baseInput, dryRun: true });
    expect(prompt).toContain("This is a dry run. Fill `messages`");
    expect(prompt).not.toContain("The runtime sends them after your turn");
    expect(prompt).not.toContain("send_whatsapp_message");
  });

  // Live turns put customer text in messages for post-run send.
  it("includes live messages rule when dryRun is false", () => {
    const prompt = buildAgentSystemPrompt({ ...baseInput, dryRun: false });
    expect(prompt).toContain("Put customer-facing replies in `messages`");
    expect(prompt).toContain("The runtime sends them after your turn");
    expect(prompt).not.toContain("send_whatsapp_message");
  });

  // Handoff flag and empty/courtesy messages are documented for the model.
  it("instructs handoff_enabled true only after handoff_to_human", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("set `handoff_enabled` to true");
    expect(prompt).toContain("prefer empty `messages`");
    expect(prompt).toContain("set `handoff_enabled` to false");
  });

  // Operators need structured knowledge refs gated by knowledge_used.
  it("instructs knowledge_used with exact knowledge labels in sources", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("Set `knowledge_used` to true");
    expect(prompt).toContain("fill `sources`");
    expect(prompt).toContain("Never invent labels");
    expect(prompt).toContain("Never put sources in `messages`");
  });

  // Reference chips only deep-link to an expanded entry when the ref names the entry and
  // its group, so the prompt must per-kind name the exact field to copy into `label`.
  it("instructs sources to name the group plus the specific item per kind", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("`group` is the `####` heading it sits under");
    expect(prompt).toContain("for `context` the entry title on the `[n]` line");
    expect(prompt).toContain("for `template` the Typical question intent text");
    expect(prompt).toContain("for `handoff` the quoted topic");
  });

  // Skills are listed without a `####` heading, so the prompt must tell the model what to
  // put in `group` for them rather than leaving it to guess or invent one.
  it("instructs an empty group for skill sources", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain(
      "Skills have no group: set `group` to an empty string and `label` to the skill name",
    );
  });

  // A group heading in `label` produces a group-only link that does not expand the fact,
  // which is the exact failure this rule exists to prevent.
  it("forbids putting a group heading in label", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("Never put a `####` heading in `label`");
  });

  // Asset delivery uses messages[].assetFileName, not a send tool.
  it("mentions assetFileName on messages items", () => {
    const prompt = buildAgentSystemPrompt({
      ...baseInput,
      assetGroups: [
        {
          name: "Menus",
          assets: [{ fileName: "menu.pdf", description: "Weekly menu" }],
        },
      ],
    });
    expect(prompt).toContain("assetFileName");
    expect(prompt).toContain("menu.pdf");
    expect(prompt).not.toContain("call `send_whatsapp_message`");
  });

  // When no asset groups are configured, the prompt should indicate that clearly.
  it('shows "(none configured)" for empty asset groups', () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("(none configured for this agent)");
  });

  // The available tools section lists enabled tool keys with their descriptions.
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

  // Confirms multi-label / recent-thread guidance is present in the system prompt.
  it("instructs apply_conversation_labels for one or more labels using recent messages", () => {
    const prompt = buildAgentSystemPrompt(baseInput);
    expect(prompt).toContain("MUST call `apply_conversation_labels`");
    expect(prompt).toContain("description/definition");
    expect(prompt).toContain("previous 10 messages");
    expect(prompt).toContain("multiple labels in one call");
    expect(prompt).toContain("Do not answer and skip labeling");
  });
});

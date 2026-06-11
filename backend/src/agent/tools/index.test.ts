import { describe, it, expect, vi } from "vitest";

vi.mock("../tools/create-task-tool.js", () => ({
  createTaskTool: vi.fn(() => ({ description: "create-task-description" })),
}));

vi.mock("../tools/apply-conversation-labels-tool.js", () => ({
  createApplyConversationLabelsTool: vi.fn(() => ({})),
}));

vi.mock("../tools/handoff-to-human-tool.js", () => ({
  createHandoffToHumanTool: vi.fn(() => ({})),
}));

vi.mock("../tools/load-skills-tool.js", () => ({
  createLoadSkillsTool: vi.fn(() => ({})),
}));

vi.mock("../tools/send-whatsapp-message-tool.js", () => ({
  createSendWhatsappMessageTool: vi.fn(() => ({})),
}));

vi.mock("../tools/custom-tools.js", () => ({
  loadCustomTools: vi.fn(async (_ctx, keys: string[]) => {
    const tools: Record<string, { description: string }> = {};
    for (const key of keys) {
      tools[key] = { description: `${key}-custom` };
    }
    return tools;
  }),
}));

import { getAgentTools } from "./index.js";
import type { AgentToolRuntimeContext } from "../tools/shared.js";

const mockContext: AgentToolRuntimeContext = {
  workspaceId: "ws-1",
  sessionId: "sess-1",
};

describe("getAgentTools", () => {
  // All builtin and custom tool keys are resolved into tool instances in one map.
  // Expected: 6 tools returned, including builtins and one custom key.
  it("returns builtin and custom tools when keys enabled", async () => {
    const tools = await getAgentTools(mockContext, [
      "create_task",
      "get_weather",
      "load_skills",
      "send_whatsapp_message",
      "handoff_to_human",
      "apply_conversation_labels",
    ]);

    const keys = Object.keys(tools);
    expect(keys).toHaveLength(6);
    expect(keys).toContain("create_task");
    expect(keys).toContain("get_weather");
    expect(keys).toContain("load_skills");
  });

  // No tools should be returned when the enabled list is empty.
  // Expected: empty object with no keys.
  it("returns empty object when enabledToolKeys is empty", async () => {
    const tools = await getAgentTools(mockContext, []);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  // Non-builtin keys are loaded as custom tools alongside builtins.
  // Expected: both the builtin key and the custom key appear in the result.
  it("loads custom tools for non-builtin keys", async () => {
    const tools = await getAgentTools(mockContext, ["create_task", "my_custom_tool"]);
    const keys = Object.keys(tools);
    expect(keys).toContain("create_task");
    expect(keys).toContain("my_custom_tool");
  });

  // A null/undefined tool keys list should be handled gracefully without crashing.
  // Expected: empty object returned, no error thrown.
  it("returns empty object when enabledToolKeys is not an array", async () => {
    const tools = await getAgentTools(mockContext, null as unknown as string[]);
    expect(Object.keys(tools)).toHaveLength(0);
  });
});

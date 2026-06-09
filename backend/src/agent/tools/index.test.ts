import { describe, it, expect, vi } from "vitest";

vi.mock("../tools/create-task-tool.js", () => ({
  createTaskTool: vi.fn(() => ({ description: "create-task-description" })),
}));

vi.mock("../tools/get-weather-tool.js", () => ({
  getWeatherTool: { description: "get-weather-description" },
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

import { getAgentTools } from "./index.js";
import type { AgentToolRuntimeContext } from "../tools/shared.js";

const mockContext: AgentToolRuntimeContext = {
  workspaceId: "ws-1",
  sessionId: "sess-1",
};

describe("getAgentTools", () => {
  it("returns all registered tools when all keys enabled", () => {
    const tools = getAgentTools(mockContext, [
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
    expect(keys).toContain("send_whatsapp_message");
    expect(keys).toContain("handoff_to_human");
    expect(keys).toContain("apply_conversation_labels");
  });

  it("returns empty object when enabledToolKeys is empty", () => {
    const tools = getAgentTools(mockContext, []);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it("skips unknown tool keys", () => {
    const tools = getAgentTools(mockContext, [
      "create_task",
      "non_existent_tool",
    ]);

    const keys = Object.keys(tools);
    expect(keys).toHaveLength(1);
    expect(keys).toContain("create_task");
    expect(keys).not.toContain("non_existent_tool");
  });

  it("returns empty object when enabledToolKeys is not an array", () => {
    const tools = getAgentTools(mockContext, null as unknown as string[]);
    expect(Object.keys(tools)).toHaveLength(0);
  });
});

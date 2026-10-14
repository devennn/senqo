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

vi.mock("../tools/execute-code-tool.js", () => ({
  createExecuteCodeTool: vi.fn((_ctx, customKeys: string[]) => ({
    description: "execute-code",
    customKeys,
  })),
}));

import { getAgentTools } from "./index.js";
import { createExecuteCodeTool } from "../tools/execute-code-tool.js";
import type { AgentToolRuntimeContext } from "../tools/shared.js";

const mockContext: AgentToolRuntimeContext = {
  workspaceId: "ws-1",
  sessionId: "sess-1",
};

describe("getAgentTools", () => {
  // Builtins resolve; catalog tools are not top-level AI tools (code mode).
  it("returns builtins including execute_code without discrete custom tools", async () => {
    const tools = await getAgentTools(mockContext, [
      "create_task",
      "get_weather",
      "load_skills",
      "handoff_to_human",
      "apply_conversation_labels",
      "execute_code",
    ]);

    const keys = Object.keys(tools);
    expect(keys).toContain("create_task");
    expect(keys).toContain("load_skills");
    expect(keys).toContain("handoff_to_human");
    expect(keys).toContain("apply_conversation_labels");
    expect(keys).toContain("execute_code");
    expect(keys).not.toContain("get_weather");
    expect(keys).not.toContain("send_whatsapp_message");
    expect(keys).toHaveLength(5);
    expect(createExecuteCodeTool).toHaveBeenCalledWith(mockContext, ["get_weather"]);
  });

  // No tools should be returned when the enabled list is empty.
  it("returns empty object when enabledToolKeys is empty", async () => {
    const tools = await getAgentTools(mockContext, []);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  // Custom keys are passed into execute_code, not registered as discrete tools.
  it("passes custom keys to execute_code without exposing them as tools", async () => {
    const tools = await getAgentTools(mockContext, [
      "create_task",
      "execute_code",
      "my_custom_tool",
    ]);
    const keys = Object.keys(tools);
    expect(keys).toContain("create_task");
    expect(keys).toContain("execute_code");
    expect(keys).not.toContain("my_custom_tool");
    expect(createExecuteCodeTool).toHaveBeenCalledWith(mockContext, ["my_custom_tool"]);
  });

  // A null/undefined tool keys list should be handled gracefully without crashing.
  it("returns empty object when enabledToolKeys is not an array", async () => {
    const tools = await getAgentTools(mockContext, null as unknown as string[]);
    expect(Object.keys(tools)).toHaveLength(0);
  });
});

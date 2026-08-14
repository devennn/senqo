import { describe, it, expect } from "vitest";
import { toWorkspaceKnowledgeHref } from "./useKnowledgeRefLinks";

describe("toWorkspaceKnowledgeHref", () => {
  // Conversation ref chips prepend the workspace prefix onto the API href.
  it("joins workspace path with query string", () => {
    const wsPath = (path: string) => `/ws-1${path}`;
    expect(toWorkspaceKnowledgeHref(wsPath, "/knowledge?contextGroupId=g1")).toBe(
      "/ws-1/knowledge?contextGroupId=g1",
    );
  });
});

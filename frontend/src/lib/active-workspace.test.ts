import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "./active-workspace";

describe("getActiveWorkspaceId", () => {
  const originalPathname = window.location.pathname;

  beforeEach(() => {
    setActiveWorkspaceId("");
  });

  afterEach(() => {
    window.history.replaceState({}, "", originalPathname);
    setActiveWorkspaceId("");
  });

  it("returns explicitly set workspace id", () => {
    setActiveWorkspaceId("ws-explicit");
    expect(getActiveWorkspaceId()).toBe("ws-explicit");
  });

  it("falls back to first URL segment on workspace routes", () => {
    window.history.replaceState({}, "", "/047be053-c7d9-4af4-b104-af8c9a019c0b/dashboard");
    expect(getActiveWorkspaceId()).toBe("047be053-c7d9-4af4-b104-af8c9a019c0b");
  });

  it("does not treat public routes as workspace ids", () => {
    window.history.replaceState({}, "", "/sign-in");
    expect(getActiveWorkspaceId()).toBe("");
  });
});

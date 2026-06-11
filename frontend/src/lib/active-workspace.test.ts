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

  // Verifies that setActiveWorkspaceId's value is returned directly when explicitly set.
  // Ensures programmatic workspace overrides work correctly for the API client.
  it("returns explicitly set workspace id", () => {
    setActiveWorkspaceId("ws-explicit");
    expect(getActiveWorkspaceId()).toBe("ws-explicit");
  });

  // Verifies fallback to URL path extraction when no explicit workspace ID is set.
  // Needed so deep-linked pages automatically pick up the workspace from the URL.
  it("falls back to first URL segment on workspace routes", () => {
    window.history.replaceState({}, "", "/047be053-c7d9-4af4-b104-af8c9a019c0b/dashboard");
    expect(getActiveWorkspaceId()).toBe("047be053-c7d9-4af4-b104-af8c9a019c0b");
  });

  // Confirms that public routes like /sign-in are not mistaken for workspace IDs.
  // Prevents unauthenticated pages from incorrectly setting a workspace context.
  it("does not treat public routes as workspace ids", () => {
    window.history.replaceState({}, "", "/sign-in");
    expect(getActiveWorkspaceId()).toBe("");
  });
});

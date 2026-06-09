import { afterEach, describe, expect, it, vi } from "vitest";

describe("getAppVersion", () => {
  const original = process.env.APP_VERSION;

  afterEach(() => {
    vi.resetModules();
    if (original === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = original;
    }
  });

  it("returns APP_VERSION when set", async () => {
    process.env.APP_VERSION = "1.2.3";
    const { getAppVersion } = await import("./app-version.js");
    expect(getAppVersion()).toBe("1.2.3");
  });

  it("falls back to package.json version when APP_VERSION is unset", async () => {
    delete process.env.APP_VERSION;
    const { getAppVersion } = await import("./app-version.js");
    expect(getAppVersion()).toBe("0.1.0");
  });
});

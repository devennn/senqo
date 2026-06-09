import { describe, it, expect } from "vitest";
import {
  normalizeWhatsappConnectionMode,
  connectionAiEnabledForComposer,
  shouldRunInboundAi,
} from "../services/inbound-ai-mode.js";

describe("normalizeWhatsappConnectionMode", () => {
  it("returns 'testing' when raw is 'testing'", () => {
    expect(normalizeWhatsappConnectionMode("testing")).toBe("testing");
  });

  it("returns 'live' when raw is 'live'", () => {
    expect(normalizeWhatsappConnectionMode("live")).toBe("live");
  });

  it("returns 'inactive' when raw is null", () => {
    expect(normalizeWhatsappConnectionMode(null)).toBe("inactive");
  });

  it("returns 'inactive' when raw is undefined", () => {
    expect(normalizeWhatsappConnectionMode(undefined)).toBe("inactive");
  });

  it("returns 'inactive' when raw is an unknown string", () => {
    expect(normalizeWhatsappConnectionMode("unknown")).toBe("inactive");
  });
});

describe("connectionAiEnabledForComposer", () => {
  it("returns false when mode is 'inactive'", () => {
    expect(connectionAiEnabledForComposer("inactive", false)).toBe(false);
  });

  it("returns true when mode is 'live'", () => {
    expect(connectionAiEnabledForComposer("live", false)).toBe(true);
  });

  it("returns true when mode is 'testing' and isTestContact is true", () => {
    expect(connectionAiEnabledForComposer("testing", true)).toBe(true);
  });

  it("returns false when mode is 'testing' and isTestContact is false", () => {
    expect(connectionAiEnabledForComposer("testing", false)).toBe(false);
  });
});

describe("shouldRunInboundAi", () => {
  it("returns false when handlingMode is 'human'", () => {
    expect(shouldRunInboundAi("live", true, "human")).toBe(false);
  });

  it("returns false when mode is 'inactive'", () => {
    expect(shouldRunInboundAi("inactive", true, "ai")).toBe(false);
  });

  it("returns false when mode is 'testing' and isTestContact is false", () => {
    expect(shouldRunInboundAi("testing", false, "ai")).toBe(false);
  });

  it("returns true when mode is 'testing' and isTestContact is true", () => {
    expect(shouldRunInboundAi("testing", true, "ai")).toBe(true);
  });

  it("returns true when mode is 'live' and handlingMode is 'ai'", () => {
    expect(shouldRunInboundAi("live", false, "ai")).toBe(true);
  });
});

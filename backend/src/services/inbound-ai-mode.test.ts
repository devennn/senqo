import { describe, it, expect } from "vitest";
import {
  normalizeWhatsappConnectionMode,
  connectionAiEnabledForComposer,
  shouldRunInboundAi,
} from "../services/inbound-ai-mode.js";

describe("normalizeWhatsappConnectionMode", () => {
  // Raw mode is "testing" → "testing" is returned, needed to ensure known active/test modes pass through unchanged.
  it("returns 'testing' when raw is 'testing'", () => {
    expect(normalizeWhatsappConnectionMode("testing")).toBe("testing");
  });

  // Raw mode is "live" → "live" is returned, needed to ensure live mode passes through unchanged.
  it("returns 'live' when raw is 'live'", () => {
    expect(normalizeWhatsappConnectionMode("live")).toBe("live");
  });

  // Raw mode is null (e.g. from a missing DB field) → "inactive" is returned, needed to default nulls to the inactive/safe state.
  it("returns 'inactive' when raw is null", () => {
    expect(normalizeWhatsappConnectionMode(null)).toBe("inactive");
  });

  // Raw mode is undefined → "inactive" is returned, needed to handle completely absent values gracefully.
  it("returns 'inactive' when raw is undefined", () => {
    expect(normalizeWhatsappConnectionMode(undefined)).toBe("inactive");
  });

  // Raw mode is an unknown string that isn't a valid mode → "inactive" is returned, needed to map any unexpected values to the safe default.
  it("returns 'inactive' when raw is an unknown string", () => {
    expect(normalizeWhatsappConnectionMode("unknown")).toBe("inactive");
  });
});

describe("connectionAiEnabledForComposer", () => {
  // Mode is "inactive" → composer AI is disabled regardless of test contact flag, needed to ensure no AI on inactive connections.
  it("returns false when mode is 'inactive'", () => {
    expect(connectionAiEnabledForComposer("inactive", false)).toBe(false);
  });

  // Mode is "live" → composer AI is enabled regardless of test contact flag, needed to ensure AI works for all live contacts.
  it("returns true when mode is 'live'", () => {
    expect(connectionAiEnabledForComposer("live", false)).toBe(true);
  });

  // Mode is "testing" and contact is a test contact → AI is enabled, needed to allow AI for designated test contacts during testing mode.
  it("returns true when mode is 'testing' and isTestContact is true", () => {
    expect(connectionAiEnabledForComposer("testing", true)).toBe(true);
  });

  // Mode is "testing" but contact is not a test contact → AI is disabled, needed to prevent AI from responding to non-test contacts during testing mode.
  it("returns false when mode is 'testing' and isTestContact is false", () => {
    expect(connectionAiEnabledForComposer("testing", false)).toBe(false);
  });
});

describe("shouldRunInboundAi", () => {
  // handlingMode is "human" even with live mode → returns false, needed to ensure human-only conversations never trigger AI.
  it("returns false when handlingMode is 'human'", () => {
    expect(shouldRunInboundAi("live", true, "human")).toBe(false);
  });

  // Mode is "inactive" → returns false, needed to block AI completely when the connection is not active.
  it("returns false when mode is 'inactive'", () => {
    expect(shouldRunInboundAi("inactive", true, "ai")).toBe(false);
  });

  // Mode is "testing" and contact is not a test contact → returns false, needed to restrict AI to test contacts only during testing mode.
  it("returns false when mode is 'testing' and isTestContact is false", () => {
    expect(shouldRunInboundAi("testing", false, "ai")).toBe(false);
  });

  // Mode is "testing" and contact is a test contact with ai handling → returns true, needed to allow AI to respond to test contacts in testing mode.
  it("returns true when mode is 'testing' and isTestContact is true", () => {
    expect(shouldRunInboundAi("testing", true, "ai")).toBe(true);
  });

  // Mode is "live" and handlingMode is "ai" → returns true, needed to confirm AI runs for all contacts when live with ai handling.
  it("returns true when mode is 'live' and handlingMode is 'ai'", () => {
    expect(shouldRunInboundAi("live", false, "ai")).toBe(true);
  });
});

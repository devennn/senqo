import { describe, it, expect } from "vitest";
import {
  connectionPhonesToDigits,
  formatHandoffPhoneDisplay,
  isHandoffPhoneAConnection,
  normalizeHandoffPhoneDigits,
} from "@/lib/handoff-phone";

describe("handoff-phone helpers", () => {
  // Formatting noise is stripped so UI and API compare the same digits.
  it("normalizeHandoffPhoneDigits → strips non-digits", () => {
    expect(normalizeHandoffPhoneDigits("+1 (555) 123-4567")).toBe("15551234567");
  });

  // Display always shows country-code plus prefix for stored digits.
  it("formatHandoffPhoneDisplay → prefixes digits with +", () => {
    expect(formatHandoffPhoneDisplay("60123456789")).toBe("+60123456789");
    expect(formatHandoffPhoneDisplay("+60 12-345 6789")).toBe("+60123456789");
    expect(formatHandoffPhoneDisplay("")).toBe("");
  });

  // Connection phones become a deduped digit list for Register validation.
  it("connectionPhonesToDigits → keeps unique valid connection numbers", () => {
    expect(
      connectionPhonesToDigits(["+1 555 123 4567", "15551234567", null, "12"]),
    ).toEqual(["15551234567"]);
  });

  // Matching a connected line must block Register before submit.
  it("isHandoffPhoneAConnection → true when candidate matches a connection", () => {
    expect(isHandoffPhoneAConnection("15551234567", ["15551234567", "19998887777"])).toBe(
      true,
    );
    expect(isHandoffPhoneAConnection("14445556666", ["15551234567"])).toBe(false);
  });
});

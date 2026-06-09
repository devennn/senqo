import { describe, expect, it } from "vitest";
import {
  isIngestableDmChatJid,
  isNewsletterChatJid,
  nonDmChatIgnoreMessage,
} from "./whatsapp-jid.js";

describe("isNewsletterChatJid", () => {
  it("returns true for channel JIDs", () => {
    expect(isNewsletterChatJid("120363123456789012@newsletter")).toBe(true);
  });
});

describe("isIngestableDmChatJid", () => {
  it("returns false for channel JIDs", () => {
    expect(isIngestableDmChatJid("120363123456789012@newsletter")).toBe(false);
  });
});

describe("nonDmChatIgnoreMessage", () => {
  it("returns channel-specific ignore text", () => {
    expect(nonDmChatIgnoreMessage("120363123456789012@newsletter")).toBe(
      "ignored: channel message",
    );
  });
});

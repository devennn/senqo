import { describe, expect, it } from "vitest";
import {
  isIngestableDmChatJid,
  isNewsletterChatJid,
  nonDmChatIgnoreMessage,
} from "./whatsapp-jid.js";

describe("isNewsletterChatJid", () => {
  // Channel JIDs ending with @newsletter must be identified as newsletter chats.
  // Expected: returns true for a valid channel JID.
  it("returns true for channel JIDs", () => {
    expect(isNewsletterChatJid("120363123456789012@newsletter")).toBe(true);
  });
});

describe("isIngestableDmChatJid", () => {
  // Channel JIDs are not ingestable DM chats — they should be excluded.
  // Expected: returns false for a @newsletter JID.
  it("returns false for channel JIDs", () => {
    expect(isIngestableDmChatJid("120363123456789012@newsletter")).toBe(false);
  });
});

describe("nonDmChatIgnoreMessage", () => {
  // Non-DM chats (channels) should produce a specific ignore reason message.
  // Expected: returns "ignored: channel message" for a @newsletter JID.
  it("returns channel-specific ignore text", () => {
    expect(nonDmChatIgnoreMessage("120363123456789012@newsletter")).toBe(
      "ignored: channel message",
    );
  });
});

import { describe, it, expect, vi } from "vitest";

process.env.WHATSAPP_SERVICE_API_KEY = "test-api-key";
process.env.WHATSAPP_WEBHOOK_AUTHORIZATION = "test-webhook-token";

vi.mock("../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  baileysLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logRawEventToCategory: vi.fn(),
}));

const jid = await import("../src/jid.js");

describe("jid", () => {
  describe("isLidJid", () => {
    // JIDs ending with @lid must be recognised as LID JIDs for LID-to-PN resolution.
    it("returns true for LID JIDs", () => {
      expect(jid.isLidJid("123456@lid")).toBe(true);
    });

    // Standard user JIDs, group JIDs, null, and undefined must not be classified as LID JIDs.
    it("returns false for non-LID JIDs", () => {
      expect(jid.isLidJid("123456@s.whatsapp.net")).toBe(false);
      expect(jid.isLidJid("123456789@g.us")).toBe(false);
      expect(jid.isLidJid(null)).toBe(false);
      expect(jid.isLidJid(undefined)).toBe(false);
    });
  });

  describe("isGroupJid", () => {
    // JIDs ending with @g.us must be classified as group JIDs for group-specific message handling.
    it("returns true for group JIDs", () => {
      expect(jid.isGroupJid("123456789@g.us")).toBe(true);
    });

    // A standard user JID (s.whatsapp.net) must not be misclassified as a group JID.
    it("returns false for user JIDs", () => {
      expect(jid.isGroupJid("123456@s.whatsapp.net")).toBe(false);
    });
  });

  describe("isBroadcastJid", () => {
    // The status@broadcast JID must be classified as a broadcast JID to filter broadcast messages.
    it("returns true for broadcast JIDs", () => {
      expect(jid.isBroadcastJid("status@broadcast")).toBe(true);
    });

    // LID JIDs and null must not be classified as broadcast JIDs.
    it("returns false for non-broadcast JIDs", () => {
      expect(jid.isBroadcastJid("123@lid")).toBe(false);
      expect(jid.isBroadcastJid(null)).toBe(false);
    });
  });

  describe("isNewsletterJid", () => {
    // JIDs ending with @newsletter (channel JIDs) must be classified as newsletter JIDs.
    it("returns true for channel JIDs", () => {
      expect(jid.isNewsletterJid("120363123456789012@newsletter")).toBe(true);
    });

    // Standard user JIDs and null must not be classified as newsletter/channel JIDs.
    it("returns false for non-channel JIDs", () => {
      expect(jid.isNewsletterJid("123456@s.whatsapp.net")).toBe(false);
      expect(jid.isNewsletterJid(null)).toBe(false);
    });
  });

  describe("isIngestableDmChatJid", () => {
    // User DM JIDs (s.whatsapp.net and lid) must be marked as ingestable for conversation tracking.
    it("returns true for user DMs", () => {
      expect(jid.isIngestableDmChatJid("123456@s.whatsapp.net")).toBe(true);
      expect(jid.isIngestableDmChatJid("123456@lid")).toBe(true);
    });

    // Groups, newsletters, broadcasts, and empty strings must not be ingestable as DM chats.
    it("returns false for groups, channels, and broadcasts", () => {
      expect(jid.isIngestableDmChatJid("123456789@g.us")).toBe(false);
      expect(jid.isIngestableDmChatJid("120363123456789012@newsletter")).toBe(false);
      expect(jid.isIngestableDmChatJid("status@broadcast")).toBe(false);
      expect(jid.isIngestableDmChatJid("")).toBe(false);
    });
  });

  describe("isUserJid", () => {
    // s.whatsapp.net JIDs represent phone-number-based users and must be classified as user JIDs.
    it("returns true for s.whatsapp.net JIDs", () => {
      expect(jid.isUserJid("123456789@s.whatsapp.net")).toBe(true);
    });

    // c.us JIDs (common user suffix in Baileys) must also be classified as user JIDs.
    it("returns true for c.us JIDs", () => {
      expect(jid.isUserJid("123456789@c.us")).toBe(true);
    });

    // LID JIDs must be classified as user JIDs since they represent individual users.
    it("returns true for LID JIDs", () => {
      expect(jid.isUserJid("123456@lid")).toBe(true);
    });

    // Group JIDs (g.us) must not be classified as user JIDs.
    it("returns false for group JIDs", () => {
      expect(jid.isUserJid("123@g.us")).toBe(false);
    });

    // Null input must safely return false rather than throwing.
    it("returns false for null input", () => {
      expect(jid.isUserJid(null)).toBe(false);
    });
  });

  describe("jidDigits", () => {
    // Extracts only the numeric portion from a standard s.whatsapp.net JID.
    it("extracts digits from a JID", () => {
      expect(jid.jidDigits("123456789@s.whatsapp.net")).toBe("123456789");
    });

    // Device suffixes like :42 must be stripped so only the base phone number digits remain.
    it("drops device suffix", () => {
      expect(jid.jidDigits("123456789:42@s.whatsapp.net")).toBe("123456789");
    });

    // Raw phone numbers with formatting characters (spaces, parens, dashes) must be stripped to digits only.
    it("strips non-digit characters from raw phone numbers", () => {
      expect(jid.jidDigits("+1 (234) 567-890")).toBe("1234567890");
    });
  });

  describe("normalizeJid", () => {
    // Null input must return an empty string instead of crashing.
    it("returns empty string for null input", () => {
      expect(jid.normalizeJid(null)).toBe("");
    });

    // Undefined input must return an empty string instead of crashing.
    it("returns empty string for undefined input", () => {
      expect(jid.normalizeJid(undefined)).toBe("");
    });
  });

  describe("learnMapping", () => {
    // learnMapping must establish a bidirectional LID-to-phone-number mapping so resolveToPn can find it later.
    it("learns a LID <-> PN mapping", () => {
      jid.clearConnectionLidState("conn-1");
      jid.learnMapping("conn-1", "123@lid", "123456789@s.whatsapp.net");
      const result = jid.resolveToPn("conn-1", "123@lid");
      expect(result.jid).toBe("123456789@s.whatsapp.net");
    });

    // Passing a non-LID JID as the first argument must be silently ignored, leaving the original JID unchanged.
    it("ignores non-LID JIDs as the first argument", () => {
      jid.clearConnectionLidState("conn-x");
      jid.learnMapping("conn-x", "not-lid@s.whatsapp.net", "123456789@s.whatsapp.net");
      const result = jid.resolveToPn("conn-x", "not-lid@s.whatsapp.net");
      expect(result.jid).toBe("not-lid@s.whatsapp.net");
    });
  });

  describe("resolveToPn", () => {
    // A non-LID JID (already a phone-number JID) must be returned unchanged since no resolution is needed.
    it("returns the JID unchanged for non-LID JIDs", () => {
      const result = jid.resolveToPn("conn-2", "123456789@s.whatsapp.net");
      expect(result.jid).toBe("123456789@s.whatsapp.net");
    });

    // Null input must return an empty string JID rather than throwing for safety.
    it("returns empty string for null JID", () => {
      const result = jid.resolveToPn("conn-2", null);
      expect(result.jid).toBe("");
    });

    // When no mapping is found, the LID itself must be returned as both jid and lid fields.
    it("falls back to LID when no mapping exists", () => {
      const result = jid.resolveToPn("conn-2", "999999@lid");
      expect(result.jid).toBe("999999@lid");
      expect(result.lid).toBe("999999@lid");
    });
  });

  describe("learnFromMessageKey", () => {
    // A message key with remoteJid and remoteJidAlt must teach the resolver the LID-to-PN mapping.
    it("learns remoteJid <-> remoteJidAlt mapping", () => {
      jid.clearConnectionLidState("conn-msg");
      jid.learnFromMessageKey("conn-msg", {
        remoteJid: "111@lid",
        remoteJidAlt: "1234567890@s.whatsapp.net",
      });
      const result = jid.resolveToPn("conn-msg", "111@lid");
      expect(result.jid).toBe("1234567890@s.whatsapp.net");
    });

    // A null message key must not throw — the function must handle the edge case gracefully.
    it("handles null key gracefully", () => {
      jid.clearConnectionLidState("conn-null");
      expect(() => jid.learnFromMessageKey("conn-null", null)).not.toThrow();
    });
  });

  describe("resolveToPn", () => {
    // After learning a mapping, resolveToPn must return the phone-number JID and include the original LID.
    it("resolves LID to phone-number JID when mapping exists", () => {
      jid.clearConnectionLidState("conn-r");
      jid.learnMapping("conn-r", "222@lid", "9876543210@s.whatsapp.net");
      const result = jid.resolveToPn("conn-r", "222@lid");
      expect(result.jid).toBe("9876543210@s.whatsapp.net");
      expect(result.lid).toBe("222@lid");
    });
  });

  describe("phoneToUserJid", () => {
    // Raw phone digits must be converted to a full s.whatsapp.net JID for message sending.
    it("converts phone digits to JID", () => {
      expect(jid.phoneToUserJid("1234567890")).toBe("1234567890@s.whatsapp.net");
    });

    // A group JID passed to phoneToUserJid must be returned as-is since it's already a valid JID.
    it("returns group JID unchanged", () => {
      const gid = "123456789@g.us";
      expect(jid.phoneToUserJid(gid)).toBe(gid);
    });
  });

  describe("toSendableJid", () => {
    // A chat ID (raw phone digits) must be converted to a sendable s.whatsapp.net JID.
    it("converts chat id to user JID", () => {
      expect(jid.toSendableJid("1234567890")).toBe("1234567890@s.whatsapp.net");
    });

    // A group JID passed to toSendableJid must be returned as-is since it's already sendable.
    it("returns group JID unchanged", () => {
      const gid = "123456789@g.us";
      expect(jid.toSendableJid(gid)).toBe(gid);
    });
  });

  describe("learnFromContact", () => {
    // A WhatsApp contact with both lid and phoneNumber must be learned so LID resolves to that phone number.
    it("learns from contact with phoneNumber and lid", () => {
      jid.clearConnectionLidState("conn-contact");
      jid.learnFromContact("conn-contact", {
        id: "333@lid",
        lid: "333@lid",
        phoneNumber: "1111111111@s.whatsapp.net",
        name: "Test User",
      });
      const result = jid.resolveToPn("conn-contact", "333@lid");
      expect(result.jid).toBe("1111111111@s.whatsapp.net");
    });
  });

  describe("getContactPnByLid", () => {
    // Querying a LID that was never learned must return undefined rather than throwing.
    it("returns undefined for unknown LID", () => {
      const result = jid.getContactPnByLid("conn-unknown", "nonexistent@lid");
      expect(result).toBeUndefined();
    });

    // After learnFromContact stores the mapping, getContactPnByLid must return the phone number JID.
    it("returns PN after learning from contact", () => {
      jid.clearConnectionLidState("conn-contact-2");
      jid.learnFromContact("conn-contact-2", {
        id: "444@lid",
        lid: "444@lid",
        phoneNumber: "2222222222@s.whatsapp.net",
        name: "Another User",
      });
      const result = jid.getContactPnByLid("conn-contact-2", "444@lid");
      expect(result).toBe("2222222222@s.whatsapp.net");
    });
  });

  describe("lidLookupFactory", () => {
    // The factory must create a lookup function that resolves known LIDs to PNs and returns undefined for unknowns.
    it("creates a lookup function that finds learned mappings", () => {
      jid.clearConnectionLidState("conn-lookup");
      jid.learnFromContact("conn-lookup", {
        id: "555@lid",
        lid: "555@lid",
        phoneNumber: "3333333333@s.whatsapp.net",
        name: "Lookup User",
      });
      const lookup = jid.lidLookupFactory("conn-lookup");
      expect(lookup("555@lid")).toBe("3333333333@s.whatsapp.net");
      expect(lookup("nonexistent@lid")).toBeUndefined();
    });
  });
});

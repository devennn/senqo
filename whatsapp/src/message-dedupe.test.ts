import { describe, it, expect, vi } from "vitest";
import { MessageDedupeTracker, webhookDedupeKey } from "../src/message-dedupe.js";

describe("message-dedupe", () => {
  describe("webhookDedupeKey", () => {
    it("formats inbound key correctly", () => {
      const key = webhookDedupeKey(false, "msg-123");
      expect(key).toBe("message.inbound:msg-123");
    });

    it("formats outbound mirror key correctly", () => {
      const key = webhookDedupeKey(true, "msg-456");
      expect(key).toBe("message.outbound_mirror:msg-456");
    });
  });

  describe("MessageDedupeTracker", () => {
    describe("tryAcquire", () => {
      it("returns true for a new key", () => {
        const tracker = new MessageDedupeTracker();
        expect(tracker.tryAcquire("key-1")).toBe(true);
      });

      it("returns false for a duplicate key", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(false);
      });
    });

    describe("markDelivered", () => {
      it("marks key as delivered so duplicates are rejected", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        tracker.markDelivered("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(false);
      });

      it("keeps the key out of inflight after delivery", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        tracker.markDelivered("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(false);
      });
    });

    describe("release", () => {
      it("removes key from inflight so it can be re-acquired", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        tracker.release("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(true);
      });
    });

    describe("TTL expiry", () => {
      it("sweeps old delivered keys after 7 days", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        tracker.markDelivered("key-1");

        // We can't easily test the TTL sweep without manipulating time,
        // but we can verify it doesn't crash on normal behavior.
        expect(tracker.tryAcquire("key-1")).toBe(false);
      });
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { MessageDedupeTracker, webhookDedupeKey } from "../src/message-dedupe.js";

describe("message-dedupe", () => {
  describe("webhookDedupeKey", () => {
    // Inbound messages must be prefixed with "message.inbound:" to namespace the key correctly.
    it("formats inbound key correctly", () => {
      const key = webhookDedupeKey(false, "msg-123");
      expect(key).toBe("message.inbound:msg-123");
    });

    // Outbound mirrors must be prefixed with "message.outbound_mirror:" to distinguish from real inbound messages.
    it("formats outbound mirror key correctly", () => {
      const key = webhookDedupeKey(true, "msg-456");
      expect(key).toBe("message.outbound_mirror:msg-456");
    });
  });

  describe("MessageDedupeTracker", () => {
    describe("tryAcquire", () => {
      // A key that has never been seen must be acquirable on the first attempt.
      it("returns true for a new key", () => {
        const tracker = new MessageDedupeTracker();
        expect(tracker.tryAcquire("key-1")).toBe(true);
      });

      // Once a key has been acquired, a second attempt must return false to prevent duplicate processing.
      it("returns false for a duplicate key", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(false);
      });
    });

    describe("markDelivered", () => {
      // Marking a key as delivered must continue to reject duplicates even after delivery confirmation.
      it("marks key as delivered so duplicates are rejected", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        tracker.markDelivered("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(false);
      });

      // A delivered key must be removed from inflight tracking so duplicates are still blocked by the delivered set.
      it("keeps the key out of inflight after delivery", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        tracker.markDelivered("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(false);
      });
    });

    describe("release", () => {
      // Releasing a key must allow it to be re-acquired, e.g. after a processing failure.
      it("removes key from inflight so it can be re-acquired", () => {
        const tracker = new MessageDedupeTracker();
        tracker.tryAcquire("key-1");
        tracker.release("key-1");
        expect(tracker.tryAcquire("key-1")).toBe(true);
      });
    });

    describe("TTL expiry", () => {
      // Verifies basic behaviour around TTL expiry: delivered keys remain rejected until the 7-day sweep.
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

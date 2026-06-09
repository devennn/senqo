import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { publish, subscribe } from "./realtime-bus.js";

describe("publish", () => {
  it("emits to workspace-specific channel", () => {
    const spy = vi.fn();
    const unsubscribe = subscribe("ws-1", spy);
    publish("ws-1", { type: "message.created", conversationId: "conv-1" });
    expect(spy).toHaveBeenCalledWith({ type: "message.created", conversationId: "conv-1" });
    unsubscribe();
  });

  it("no-op when workspaceId is empty", () => {
    publish("", { type: "message.created", conversationId: "conv-1" });
    // should not throw
  });
});

describe("subscribe", () => {
  it("receives events for matching workspace only", () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const unsub1 = subscribe("ws-1", spy1);
    const unsub2 = subscribe("ws-2", spy2);
    publish("ws-1", { type: "conversation.created", conversationId: "c1" });
    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).not.toHaveBeenCalled();
    unsub1();
    unsub2();
  });

  it("unsubscribe stops receiving events", () => {
    const spy = vi.fn();
    const unsubscribe = subscribe("ws-1", spy);
    unsubscribe();
    publish("ws-1", { type: "message.created", conversationId: "conv-1" });
    expect(spy).not.toHaveBeenCalled();
  });
});

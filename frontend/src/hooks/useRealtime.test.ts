import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetAccessToken = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  getAccessToken: mockGetAccessToken,
}));

const { useRealtime } = await import("@/hooks/useRealtime");

import { renderHook } from "@testing-library/react";

let eventSourceInstances: MockEventSource[] = [];
const addEventSource = (es: MockEventSource) => eventSourceInstances.push(es);

class MockEventSource {
  url: string;
  onerror: (() => void) | null = null;
  private listeners: Map<string, (e: MessageEvent) => void> = new Map();

  constructor(url: string) {
    this.url = url;
    addEventSource(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    this.listeners.set(type, handler);
  }

  close() {}

  dispatchEvent(type: string, data: unknown) {
    const handler = this.listeners.get(type);
    if (handler) {
      handler({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  eventSourceInstances = [];
  mockGetAccessToken.mockResolvedValue("test-token");
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource =
    MockEventSource;
  // Mock import.meta.env
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("useRealtime", () => {
  it("subscribes to SSE when workspaceId is provided", async () => {
    const onEvent = vi.fn();

    renderHook(() => useRealtime("ws-1", onEvent));

    await vi.waitFor(() => {
      expect(eventSourceInstances.length).toBeGreaterThan(0);
    });

    const es = eventSourceInstances[0];
    expect(es.url).toContain("workspaceId=ws-1");
    expect(es.url).toContain("token=test-token");
  });

  it("does not subscribe when workspaceId is null", () => {
    const onEvent = vi.fn();

    renderHook(() => useRealtime(null, onEvent));

    expect(eventSourceInstances.length).toBe(0);
  });

  it("calls onEvent when a 'message.created' SSE event arrives", async () => {
    const onEvent = vi.fn();

    renderHook(() => useRealtime("ws-1", onEvent));

    await vi.waitFor(() => {
      expect(eventSourceInstances.length).toBeGreaterThan(0);
    });

    const es = eventSourceInstances[0];
    es.dispatchEvent("message.created", {
      type: "message.created",
      conversationId: "conv-1",
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "message.created",
      conversationId: "conv-1",
    });
  });

  it("cleans up EventSource on unmount", async () => {
    const onEvent = vi.fn();
    const closeSpy = vi.spyOn(MockEventSource.prototype, "close");

    const { unmount } = renderHook(() => useRealtime("ws-1", onEvent));

    await vi.waitFor(() => {
      expect(eventSourceInstances.length).toBeGreaterThan(0);
    });

    unmount();
    expect(closeSpy).toHaveBeenCalled();
  });
});

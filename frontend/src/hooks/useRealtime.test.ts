import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetAccessToken = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  getAccessToken: mockGetAccessToken,
}));

const mockFetch = vi.fn();

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
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ ticket: "test-ticket" }),
  });
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource =
    MockEventSource;
  // Mock import.meta.env
  vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("useRealtime", () => {
  // Verifies that an EventSource is opened with the workspaceId and a single-use ticket — never the
  // access token itself. Keeps reusable credentials out of URLs (and request logs) while scoping the
  // stream to the current workspace so only relevant events arrive.
  it("subscribes to SSE with a single-use ticket when workspaceId is provided", async () => {
    const onEvent = vi.fn();

    renderHook(() => useRealtime("ws-1", onEvent));

    await vi.waitFor(() => {
      expect(eventSourceInstances.length).toBeGreaterThan(0);
    });

    const es = eventSourceInstances[0];
    expect(es.url).toContain("workspaceId=ws-1");
    expect(es.url).toContain("ticket=test-ticket");
    expect(es.url).not.toContain("token=");
  });

  // Confirms that no EventSource is created when workspaceId is null/falsy.
  // Prevents SSE connections from being opened before a workspace is selected.
  it("does not subscribe when workspaceId is null", () => {
    const onEvent = vi.fn();

    renderHook(() => useRealtime(null, onEvent));

    expect(eventSourceInstances.length).toBe(0);
  });

  // Failure path for the ticket exchange (backend down or expired session): no stream may open,
  // and the hook must never fall back to putting the access token in the URL.
  it("does not open a stream when the ticket request fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const onEvent = vi.fn();

    renderHook(() => useRealtime("ws-1", onEvent));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(eventSourceInstances.length).toBe(0);
  });

  // Verifies that the onEvent callback is invoked with parsed JSON when an SSE event arrives.
  // Critical for live message updates: new messages must trigger UI refresh without page reload.
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

  // Confirms that the EventSource is closed when the component using the hook unmounts.
  // Prevents memory leaks and dangling connections that could exhaust server resources.
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

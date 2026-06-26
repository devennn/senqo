import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("./env.js", () => ({
  env: {
    backendWebhookUrl: "http://backend/api/whatsapp/events",
    webhookToken: "test-token",
  },
}));

vi.mock("./logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  logRawEventToCategory: vi.fn(),
}));

vi.mock("./log-payload.js", () => ({
  eventPayloadForLog: vi.fn().mockReturnValue({ redacted: true }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("deliverEvent — connection state events", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  // Happy path: connection.state event is POSTed to the backend webhook URL with the correct token.
  // Verifies that the event reaches the backend on the first attempt when it returns 200.
  it("POSTs connection.state event to backend webhook", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: vi.fn().mockResolvedValue("") });

    const { deliverEvent } = await import("./webhook.js");

    await deliverEvent({
      type: "connection.state",
      connectionId: "conn-1",
      state: "open",
      phone: "+1234567890",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("token=test-token");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.type).toBe("connection.state");
    expect(body.connectionId).toBe("conn-1");
    expect(body.state).toBe("open");
  });

  // When the backend returns a non-2xx status, the event is retried up to 4 times.
  // Verifies the retry loop runs the expected number of attempts before giving up.
  it("retries up to 4 times on non-2xx backend response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("Service unavailable"),
    });
    vi.useFakeTimers();

    const { deliverEvent } = await import("./webhook.js");
    const deliveryPromise = deliverEvent({
      type: "connection.state",
      connectionId: "conn-1",
      state: "close",
      phone: null,
    });

    // Advance timers to flush all retry sleep() calls (250ms, 500ms, 1000ms)
    await vi.runAllTimersAsync();
    await deliveryPromise;

    expect(fetchMock).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  // On network error (fetch throws), the event is retried — network failures are transient.
  it("retries on fetch network error", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.useFakeTimers();

    const { deliverEvent } = await import("./webhook.js");
    const deliveryPromise = deliverEvent({
      type: "connection.state",
      connectionId: "conn-1",
      state: "close",
      phone: null,
    });

    await vi.runAllTimersAsync();
    await deliveryPromise;

    expect(fetchMock).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  // When delivery succeeds on first attempt, only one fetch is made.
  // Verifies there's no over-fetching on the happy path.
  it("does not retry when first attempt succeeds", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: vi.fn().mockResolvedValue("") });

    const { deliverEvent } = await import("./webhook.js");

    await deliverEvent({
      type: "connection.state",
      connectionId: "conn-2",
      state: "open",
      phone: "+9876543210",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

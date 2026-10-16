import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLookup = vi.fn();

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

const { sandboxFetch } = await import("./bridges.js");

const fetchMock = vi.fn();

function jsonResponse(overrides: Partial<Response> & { status: number }): Response {
  return {
    ok: overrides.status >= 200 && overrides.status < 300,
    headers: new Headers(),
    body: { cancel: async () => {} },
    text: async () => "",
    ...overrides,
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  mockLookup.mockReset();
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sandboxFetch", () => {
  // Happy path: a validated public URL returns the response body to the sandbox.
  it("returns the response body for a safe URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 200, text: async () => "hello" }));

    const result = await sandboxFetch("https://example.com/", undefined, 5_000);

    expect(result).toEqual({ ok: true, status: 200, body: "hello" });
  });

  // Security regression (S-06): fetch used to follow redirects internally, so a redirect to a
  // private address bypassed the guard. Every hop must be re-validated → private redirect refused.
  it("rejects a redirect pointing at a private address", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 302,
        headers: new Headers({ location: "http://10.0.0.1/secret" }),
      }),
    );

    await expect(sandboxFetch("https://example.com/", undefined, 5_000)).rejects.toThrow(
      "private addresses is not allowed",
    );
  });

  // Redirects to other public hosts must still work — the guard re-validates and follows them.
  it("follows a redirect to another safe host and returns the final body", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          status: 302,
          headers: new Headers({ location: "https://cdn.example.org/file" }),
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: 200, text: async () => "final" }));

    const result = await sandboxFetch("https://example.com/", undefined, 5_000);

    expect(result.body).toBe("final");
    expect(String(fetchMock.mock.calls[1][0])).toContain("cdn.example.org");
  });

  // Native fetch drops credential headers on cross-origin redirects; the manual loop must do
  // the same so tool-provided secrets cannot be forwarded to another origin.
  it("strips authorization headers on a cross-origin redirect", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          status: 302,
          headers: new Headers({ location: "https://cdn.example.org/file" }),
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: 200, text: async () => "ok" }));

    await sandboxFetch(
      "https://example.com/",
      { headers: { Authorization: "Bearer tool-secret" } },
      5_000,
    );

    const secondCallHeaders = fetchMock.mock.calls[1][1]?.headers as
      | Record<string, string>
      | undefined;
    expect(secondCallHeaders?.Authorization).toBeUndefined();
  });

  // Unbounded redirect loops could hang a sandboxed tool run; the loop must give up after
  // MAX_REDIRECTS hops instead of following forever.
  it("rejects when redirects exceed the hop limit", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 302,
        headers: new Headers({ location: "https://example.com/loop" }),
      }),
    );

    await expect(sandboxFetch("https://example.com/", undefined, 5_000)).rejects.toThrow(
      "Too many redirects.",
    );
  });
});

import { describe, it, expect } from "vitest";
import { createCustomToolFailureTracker } from "./tool-failures.js";

describe("createCustomToolFailureTracker", () => {
  // The runtime suppresses the customer reply only when a custom tool is still
  // failing, so the reported error detail must survive into the summary.
  it("records a custom tool failure with its error detail", () => {
    const tracker = createCustomToolFailureTracker(["get_weather"]);
    tracker.observeToolResults([
      { toolName: "get_weather", output: { ok: false, error: "TypeError: fetch failed" } },
    ]);

    expect(tracker.summarize()).toBe("get_weather: TypeError: fetch failed");
  });

  // Nested callTool failures inside execute_code must surface under the catalog key.
  it("records nested execute_code toolResults failures under the catalog key", () => {
    const tracker = createCustomToolFailureTracker(["get_weather"]);
    tracker.observeToolResults([
      {
        toolName: "execute_code",
        output: {
          ok: true,
          result: {},
          toolResults: [
            {
              toolKey: "get_weather",
              output: { ok: false, error: "TypeError: fetch failed" },
            },
          ],
        },
      },
    ]);

    expect(tracker.summarize()).toBe("get_weather: TypeError: fetch failed");
  });

  // Outer execute_code ok:false is tracked even when no nested results exist.
  it("records an outer execute_code failure", () => {
    const tracker = createCustomToolFailureTracker(["get_weather"]);
    tracker.observeToolResults([
      {
        toolName: "execute_code",
        output: { ok: false, error: "Compile failed", toolResults: [] },
      },
    ]);

    expect(tracker.summarize()).toBe("execute_code: Compile failed");
  });

  // A retried call that succeeds means the internal problem recovered; forcing a
  // handoff then would drop a valid answer the customer should receive.
  it("clears the failure when a later call to the same tool succeeds", () => {
    const tracker = createCustomToolFailureTracker(["get_weather"]);
    tracker.observeToolResults([
      { toolName: "get_weather", output: { ok: false, error: "TypeError: fetch failed" } },
    ]);
    tracker.observeToolResults([
      { toolName: "get_weather", output: { ok: true, temperature: 31 } },
    ]);

    expect(tracker.summarize()).toBeNull();
  });

  // Nested success clears a prior nested failure for that catalog key.
  it("clears nested failures when a later execute_code succeeds that tool", () => {
    const tracker = createCustomToolFailureTracker(["get_weather"]);
    tracker.observeToolResults([
      {
        toolName: "execute_code",
        output: {
          ok: true,
          result: {},
          toolResults: [
            {
              toolKey: "get_weather",
              output: { ok: false, error: "TypeError: fetch failed" },
            },
          ],
        },
      },
    ]);
    tracker.observeToolResults([
      {
        toolName: "execute_code",
        output: {
          ok: true,
          result: { temperature: 31 },
          toolResults: [
            {
              toolKey: "get_weather",
              output: { ok: true, temperature: 31 },
            },
          ],
        },
      },
    ]);

    expect(tracker.summarize()).toBeNull();
  });

  // Built-in tools have their own error contracts (for example label validation),
  // so their ok:false results must not trigger an internal-error handoff.
  it("ignores failures from tools outside the custom key set", () => {
    const tracker = createCustomToolFailureTracker(["get_weather"]);
    tracker.observeToolResults([
      { toolName: "apply_conversation_labels", output: { ok: false, error: "invalid label" } },
    ]);

    expect(tracker.summarize()).toBeNull();
  });

  // Custom tools may return arbitrary payloads; only the documented ok:false
  // convention counts as a failure.
  it("ignores results without an explicit ok:false", () => {
    const tracker = createCustomToolFailureTracker(["lookup"]);
    tracker.observeToolResults([
      { toolName: "lookup", output: { status: "not_found" } },
      { toolName: "lookup", output: "plain string" },
      { toolName: "lookup", output: null },
    ]);

    expect(tracker.summarize()).toBeNull();
  });

  // Multiple concurrently failing tools must all be reported to operators.
  it("joins every still-failing tool into one summary", () => {
    const tracker = createCustomToolFailureTracker(["get_weather", "lookup_order"]);
    tracker.observeToolResults([
      { toolName: "get_weather", output: { ok: false, error: "TypeError: fetch failed" } },
      { toolName: "lookup_order", output: { ok: false, error: "timeout" } },
    ]);

    expect(tracker.summarize()).toBe(
      "get_weather: TypeError: fetch failed; lookup_order: timeout",
    );
  });

  // Malformed error payloads still count as failures so the reply is suppressed.
  it("uses a fallback detail when ok:false carries no error string", () => {
    const tracker = createCustomToolFailureTracker(["get_weather"]);
    tracker.observeToolResults([{ toolName: "get_weather", output: { ok: false } }]);

    expect(tracker.summarize()).toBe("get_weather: Tool returned ok: false");
  });
});

import { describe, it, expect, vi } from "vitest";

// Validation paths never touch the database, so the pool stays unconnected here.
vi.mock("../db/index.js", () => ({ db: {} }));

const {
  addWorkspaceButtonTemplateEntry,
  getWorkspaceButtonTemplateForSend,
  normalizeButtonTemplateGroupIds,
  parseButtonTemplateButtons,
} = await import("./button-templates.js");

const baseEntry = {
  workspaceId: "ws-1",
  groupId: "group-1",
  title: "Confirm appointment",
  body: "Should I confirm your 3pm appointment?",
};

describe("parseButtonTemplateButtons", () => {
  // Stored JSON must round-trip into typed buttons so the prompt and the send
  // path both see the same labels, types, and values.
  it("parses a valid 1-3 button list preserving order", () => {
    const parsed = parseButtonTemplateButtons([
      { type: "quick_reply", label: "Yes", value: "yes" },
      { type: "cta_url", label: "Docs", value: "https://example.com" },
      { type: "cta_copy", label: "Code", value: "SAVE10" },
    ]);

    expect(parsed).toEqual([
      { type: "quick_reply", label: "Yes", value: "yes" },
      { type: "cta_url", label: "Docs", value: "https://example.com" },
      { type: "cta_copy", label: "Code", value: "SAVE10" },
    ]);
  });

  // Malformed stored data must be rejected loudly instead of sending a broken
  // interactive message to a customer.
  it("returns null for empty, oversized, or malformed button lists", () => {
    expect(parseButtonTemplateButtons([])).toBeNull();
    expect(parseButtonTemplateButtons(null)).toBeNull();
    expect(
      parseButtonTemplateButtons([
        { type: "quick_reply", label: "a", value: "1" },
        { type: "quick_reply", label: "b", value: "2" },
        { type: "quick_reply", label: "c", value: "3" },
        { type: "quick_reply", label: "d", value: "4" },
      ]),
    ).toBeNull();
    expect(parseButtonTemplateButtons([{ type: "unknown_type", label: "a", value: "1" }])).toBeNull();
    expect(parseButtonTemplateButtons([{ type: "quick_reply", label: "a" }])).toBeNull();
    expect(parseButtonTemplateButtons([{ type: "quick_reply", label: "  ", value: "1" }])).toBeNull();
  });
});

describe("addWorkspaceButtonTemplateEntry validation", () => {
  // A template without a name or message text would render an empty bubble.
  it("rejects blank title or body", async () => {
    const missingTitle = await addWorkspaceButtonTemplateEntry({
      ...baseEntry,
      title: "  ",
      buttons: [{ type: "quick_reply", label: "Yes", value: "yes" }],
    });
    expect(missingTitle).toEqual({
      ok: false,
      message: "Name and message text are required.",
    });

    const missingBody = await addWorkspaceButtonTemplateEntry({
      ...baseEntry,
      body: "",
      buttons: [{ type: "quick_reply", label: "Yes", value: "yes" }],
    });
    expect(missingBody).toEqual({
      ok: false,
      message: "Name and message text are required.",
    });
  });

  // A URL button with a non-http value renders nothing usable in WhatsApp.
  it("rejects cta_url buttons without an http(s) link", async () => {
    const result = await addWorkspaceButtonTemplateEntry({
      ...baseEntry,
      buttons: [{ type: "cta_url", label: "Docs", value: "example.com" }],
    });

    expect(result).toEqual({
      ok: false,
      message: "URL buttons need a valid https:// link.",
    });
  });

  // Call buttons must carry a dialable number, not free text.
  it("rejects cta_call buttons without a phone number", async () => {
    const result = await addWorkspaceButtonTemplateEntry({
      ...baseEntry,
      buttons: [{ type: "cta_call", label: "Call us", value: "call me maybe" }],
    });

    expect(result).toEqual({
      ok: false,
      message: "Call buttons need a phone number.",
    });
  });
});

describe("getWorkspaceButtonTemplateForSend", () => {
  // An agent without attached button groups must not be able to send any
  // template; the guard returns before querying the database.
  it("returns null when no groups are attached", async () => {
    const result = await getWorkspaceButtonTemplateForSend("ws-1", [], "entry-1");
    expect(result).toBeNull();
  });
});

describe("normalizeButtonTemplateGroupIds", () => {
  // Stored jsonb ids are stringified and emptied entries dropped, matching the
  // response-template normalizer so attachment checks read the same ids.
  it("stringifies array entries, drops empties, and rejects non-arrays", () => {
    expect(normalizeButtonTemplateGroupIds(["a", "", "b"])).toEqual(["a", "b"]);
    expect(normalizeButtonTemplateGroupIds("nope")).toEqual([]);
    expect(normalizeButtonTemplateGroupIds(undefined)).toEqual([]);
  });
});

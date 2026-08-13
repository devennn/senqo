import { describe, it, expect } from "vitest";
import {
  formatContextGroups,
  truncateBusinessContext,
} from "./business-context.js";
import { formatBusinessContextBlock } from "./spec/prompt.js";

describe("eval Spec business context helpers", () => {
  // Context groups → readable briefing text for Spec prompts.
  it("formatContextGroups → joins group names and fact title/body", () => {
    const text = formatContextGroups([
      {
        name: "Ops",
        entries: [{ title: "Hours", body_text: "Open 9–6." }],
      },
    ]);

    expect(text).toContain("#### Ops");
    expect(text).toContain("[1] Hours");
    expect(text).toContain("Open 9–6.");
  });

  // Long context → truncated so Spec prompts stay bounded.
  it("truncateBusinessContext → appends ellipsis when over max", () => {
    expect(truncateBusinessContext("abcdefghij", 5)).toBe("abcd…");
    expect(truncateBusinessContext("short", 50)).toBe("short");
  });

  // Empty context → no prompt block; non-empty → labeled briefing.
  it("formatBusinessContextBlock → empty when blank, labeled when present", () => {
    expect(formatBusinessContextBlock("  ")).toBe("");
    expect(formatBusinessContextBlock("We sell coffee.")).toContain(
      "Business context",
    );
    expect(formatBusinessContextBlock("We sell coffee.")).toContain("We sell coffee.");
  });
});

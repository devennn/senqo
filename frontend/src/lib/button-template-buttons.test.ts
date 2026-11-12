import { describe, it, expect } from "vitest";
import {
  shouldAutoFillReplyId,
  slugifyButtonReplyId,
} from "@/lib/button-template-buttons";

describe("slugifyButtonReplyId", () => {
  // Labels become lowercase snake_case ids so the payload stays stable and
  // readable in the conversation history.
  it("lowercases and joins words with underscores", () => {
    expect(slugifyButtonReplyId("Yes please!")).toBe("yes_please");
    expect(slugifyButtonReplyId("  Book a demo  ")).toBe("book_a_demo");
    expect(slugifyButtonReplyId("OK")).toBe("ok");
  });

  // Labels without ASCII word characters produce no id, so the author keeps
  // control instead of getting an empty or mangled value.
  it("returns an empty string for non-Latin labels", () => {
    expect(slugifyButtonReplyId("はい")).toBe("");
    expect(slugifyButtonReplyId("!!!")).toBe("");
  });
});

describe("shouldAutoFillReplyId", () => {
  // Syncing continues while the value is empty or still matches the label.
  it("is true for empty values and values that match the label slug", () => {
    expect(
      shouldAutoFillReplyId({ type: "quick_reply", label: "Yes", value: "" }),
    ).toBe(true);
    expect(
      shouldAutoFillReplyId({ type: "quick_reply", label: "Yes please", value: "yes_please" }),
    ).toBe(true);
  });

  // A hand-edited id is an explicit choice and stops syncing.
  it("is false once the value differs from the label slug", () => {
    expect(
      shouldAutoFillReplyId({ type: "quick_reply", label: "Yes", value: "confirm_yes" }),
    ).toBe(false);
  });

  // Only quick replies have a label-derived value.
  it("is false for link, call, and copy buttons", () => {
    expect(
      shouldAutoFillReplyId({ type: "cta_url", label: "Docs", value: "" }),
    ).toBe(false);
  });
});

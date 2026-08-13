import { describe, it, expect } from "vitest";
import { evalJudgeResultSchema } from "./schema.js";

describe("evalJudgeResultSchema", () => {
  // Valid Judge payload with all required keys → parses, needed for Azure structured output.
  it("accepts a pass result with critique", () => {
    const parsed = evalJudgeResultSchema.safeParse({
      passed: true,
      answerAnalysis: "Matched expected refund policy.",
      critique: "",
    });

    expect(parsed.success).toBe(true);
  });

  // Empty analysis → fails, needed so UI always has operator-facing copy.
  it("rejects empty answerAnalysis", () => {
    const parsed = evalJudgeResultSchema.safeParse({
      passed: false,
      answerAnalysis: "",
      critique: "Missing refund window",
    });

    expect(parsed.success).toBe(false);
  });

  // Missing critique key → fails, needed because Azure requires every property in required[].
  it("rejects payloads missing critique", () => {
    const parsed = evalJudgeResultSchema.safeParse({
      passed: true,
      answerAnalysis: "Matched expected refund policy.",
    });

    expect(parsed.success).toBe(false);
  });
});

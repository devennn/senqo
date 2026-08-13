import { describe, it, expect } from "vitest";
import { evalKnowledgeDraftSchema, evalSpecDraftSchema } from "./schema.js";

describe("evalSpecDraftSchema", () => {
  // Valid Spec agent payload with required turn fields → parses for Azure structured output.
  it("accepts a complete draft object", () => {
    const parsed = evalSpecDraftSchema.safeParse({
      title: "Refund window",
      turns: [
        { role: "user", content: "Can I get a refund after 30 days?", whyReply: "", sources: [] },
        {
          role: "assistant",
          content: "Yes within 90 days.",
          whyReply: "Used old policy",
          sources: [{ kind: "context", label: "Refund policy" }],
        },
      ],
      expectedReply: "Refunds are only within 14 days.",
      answerAnalysis: "Agent used an outdated 90-day window.",
      answerCorrect: false,
    });

    expect(parsed.success).toBe(true);
  });

  // Missing expectedReply → parse fails, needed so incomplete Spec output is rejected at the boundary.
  it("rejects drafts without expectedReply", () => {
    const parsed = evalSpecDraftSchema.safeParse({
      title: "Refund window",
      turns: [{ role: "user", content: "Hi", whyReply: "", sources: [] }],
      answerAnalysis: "Wrong",
      answerCorrect: false,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("evalKnowledgeDraftSchema", () => {
  // Knowledge Spec output omits expectedReply (taken from the entry) → still parses.
  it("accepts title, turns, and answerAnalysis without expectedReply", () => {
    const parsed = evalKnowledgeDraftSchema.safeParse({
      title: "Delivery check",
      turns: [{ role: "user", content: "Do you deliver?", whyReply: "", sources: [] }],
      answerAnalysis: "Checks delivery context.",
    });

    expect(parsed.success).toBe(true);
  });
});

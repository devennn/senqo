import { describe, it, expect } from "vitest";
import { judgeHandoffDeterministic } from "./handoff.js";

describe("judgeHandoffDeterministic", () => {
  // Missing handoff tool call → fail, needed so reply-only subject runs do not pass handoff cases.
  it("fails when the subject did not call handoff_to_human", () => {
    const result = judgeHandoffDeterministic({
      turns: [{ role: "user", content: "I want a refund after 60 days" }],
      expectedAction: "handoff",
      expectedReply: "",
      expectedTopicEntryId: "topic-1",
      expectedTopicLabel: "Refund disputes",
      actualReply: "Let me check that for you.",
      handoffCalled: false,
      handoffTopicEntryId: null,
    });
    expect(result.passed).toBe(false);
    expect(result.answerAnalysis).toContain("did not call handoff_to_human");
  });

  // Wrong topic id → fail, needed so agents cannot pass by handing off to an unrelated topic.
  it("fails when topicEntryId does not match", () => {
    const result = judgeHandoffDeterministic({
      turns: [{ role: "user", content: "Escalate please" }],
      expectedAction: "handoff",
      expectedReply: "",
      expectedTopicEntryId: "topic-1",
      expectedTopicLabel: "Refund disputes",
      actualReply: "",
      handoffCalled: true,
      handoffTopicEntryId: "topic-other",
    });
    expect(result.passed).toBe(false);
    expect(result.critique).toContain("mismatch");
  });

  // Matching handoff + topic → pass, needed for the happy path of Knowledge → Handoff evals.
  it("passes when handoff is called with the expected topic", () => {
    const result = judgeHandoffDeterministic({
      turns: [{ role: "user", content: "Escalate please" }],
      expectedAction: "handoff",
      expectedReply: "",
      expectedTopicEntryId: "topic-1",
      expectedTopicLabel: "Refund disputes",
      actualReply: "Connecting you now.",
      handoffCalled: true,
      handoffTopicEntryId: "topic-1",
    });
    expect(result.passed).toBe(true);
    expect(result.answerAnalysis).toContain("Refund disputes");
  });
});

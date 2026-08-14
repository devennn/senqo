import { describe, it, expect } from "vitest";
import {
  getOperatorAiSources,
  shouldShowOperatorAiReasoningFooter,
} from "./conversation-operator-ai-reasoning";
import type { ConversationMessage } from "@/types/repositories";

function msg(
  partial: Partial<ConversationMessage> & Pick<ConversationMessage, "id">,
): ConversationMessage {
  return {
    role: "assistant",
    content: "Hi",
    created_at: "2026-08-01T00:00:00.000Z",
    metadata: null,
    outgoing_sender_type: "ai_agent",
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
    ...partial,
  };
}

describe("getOperatorAiSources", () => {
  // Dashboard chips must only show well-formed knowledge refs from message metadata.
  it("returns valid ai_sources and drops invalid entries", () => {
    const message = msg({
      id: "m1",
      metadata: {
        ai_sources: [
          { kind: "context", label: "Refund policy", id: "ctx-1", groupId: "grp-1" },
          { kind: "template", label: "  " },
          { kind: "unknown", label: "Nope" },
        ],
      },
    });
    expect(getOperatorAiSources(message)).toEqual([
      { kind: "context", label: "Refund policy", id: "ctx-1", groupId: "grp-1" },
    ]);
  });
});

describe("shouldShowOperatorAiReasoningFooter", () => {
  // Sources-only replies still need the Reasoning row so operators can open References.
  it("shows the footer when sources exist even without reasoning text", () => {
    const message = msg({
      id: "m1",
      metadata: {
        agent_run_id: "run-1",
        ai_sources: [{ kind: "skill", label: "Booking flow" }],
      },
    });
    expect(shouldShowOperatorAiReasoningFooter(message, null)).toBe(true);
  });

  // Multi-bubble runs should show insight once, on the last bubble.
  it("hides the footer on earlier bubbles in the same agent run", () => {
    const first = msg({
      id: "m1",
      metadata: {
        agent_run_id: "run-1",
        ai_reasoning: "Used hours",
        ai_sources: [{ kind: "context", label: "Hours" }],
      },
    });
    const next = msg({
      id: "m2",
      metadata: { agent_run_id: "run-1", ai_reasoning: "Used hours" },
    });
    expect(shouldShowOperatorAiReasoningFooter(first, next)).toBe(false);
  });
});

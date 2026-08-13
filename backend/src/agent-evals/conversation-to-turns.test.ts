import { describe, it, expect } from "vitest";
import { conversationMessagesToEvalTurns } from "./conversation-to-turns.js";
import type { ConversationMessage } from "../types/repositories.js";

function msg(partial: Partial<ConversationMessage> & Pick<ConversationMessage, "role" | "content">): ConversationMessage {
  return {
    id: partial.id ?? "m1",
    role: partial.role,
    content: partial.content,
    created_at: partial.created_at ?? "2026-08-01T00:00:00.000Z",
    metadata: partial.metadata ?? null,
    outgoing_sender_type: partial.outgoing_sender_type ?? null,
    whatsapp_sender_chat_id: partial.whatsapp_sender_chat_id ?? null,
    whatsapp_sender_name: partial.whatsapp_sender_name ?? null,
    media: partial.media ?? null,
  };
}

describe("conversationMessagesToEvalTurns", () => {
  // Inbox messages with AI reasoning → eval turns keep whyReply and skip handoff markers, needed for Spec input fidelity.
  it("maps roles and ai_reasoning while skipping thread events", () => {
    const turns = conversationMessagesToEvalTurns([
      msg({ role: "user", content: "Need a refund" }),
      msg({
        role: "assistant",
        content: "Sure, 90 days",
        outgoing_sender_type: "ai_agent",
        metadata: { ai_reasoning: "Used refund policy" },
      }),
      msg({
        role: "assistant",
        content: "Handoff",
        metadata: { thread_event: "handoff_to_human" },
      }),
    ]);

    expect(turns).toEqual([
      { role: "user", content: "Need a refund" },
      {
        role: "assistant",
        content: "Sure, 90 days",
        whyReply: "Used refund policy",
      },
    ]);
  });
});

describe("stripTrailingAssistantTurns", () => {
  // Conversation reports include the bad AI reply; stripping it keeps the case as a prompt ending on the user ask.
  it("removes trailing assistant turns so the case ends on the user ask", async () => {
    const { stripTrailingAssistantTurns } = await import("./conversation-to-turns.js");
    expect(
      stripTrailingAssistantTurns([
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "Hours?" },
        { role: "assistant", content: "Wrong hours", whyReply: "Guessed", sources: [] },
      ]),
    ).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello" },
      { role: "user", content: "Hours?" },
    ]);
  });

  // Already ends on user → unchanged, needed so manual cases stay intact.
  it("leaves turns unchanged when they already end on a user message", async () => {
    const { stripTrailingAssistantTurns } = await import("./conversation-to-turns.js");
    const turns = [
      { role: "user" as const, content: "Hi" },
      { role: "assistant" as const, content: "Hello" },
      { role: "user" as const, content: "Hours?" },
    ];
    expect(stripTrailingAssistantTurns(turns)).toBe(turns);
  });
});

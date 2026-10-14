import { describe, it, expect } from "vitest";
import { getMessageClusterSenderKey } from "@/lib/conversation-message-cluster";
import type { ConversationMessage } from "@/types/repositories";

function buildAiMessage(metadata: Record<string, unknown>): ConversationMessage {
  return {
    id: "msg-ai-1",
    role: "assistant",
    content: "Reply",
    created_at: "2026-09-23T10:00:00.000Z",
    metadata,
    outgoing_sender_type: "ai_agent",
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
  };
}

describe("getMessageClusterSenderKey", () => {
  // A dry-run draft must not merge visually with live AI bubbles, so the gray
  // not-sent bubble keeps its own header and spacing.
  it("uses a separate key for dry-run drafts", () => {
    expect(
      getMessageClusterSenderKey(buildAiMessage({ dry_run: true })),
    ).toBe("out:dry_run");
  });

  // Live AI replies keep their existing cluster key, guarding against the
  // dry-run branch leaking into real sends.
  it("keeps out:ai for live AI replies", () => {
    expect(getMessageClusterSenderKey(buildAiMessage({}))).toBe("out:ai");
  });
});

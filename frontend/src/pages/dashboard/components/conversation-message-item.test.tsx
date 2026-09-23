import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConversationMessageItem } from "@/pages/dashboard/components/conversation-message-item";
import type { ConversationMessage } from "@/types/repositories";

function buildThreadEventMessage(
  metadata: Record<string, unknown>,
): ConversationMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "You replied from the app",
    created_at: "2026-09-23T10:00:00.000Z",
    metadata,
    outgoing_sender_type: null,
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
  };
}

const baseProps = {
  previousMessage: null,
  nextMessage: null,
  groupParticipantColorOrderByKey: new Map<string, number>(),
  quotedParticipantDisplayLookup: new Map<string, string>(),
  whatsappExternalIdLookup: new Map<string, string>(),
  flashingMessageId: null,
  onQuoteNavigate: () => {},
};

describe("ConversationMessageItem", () => {
  // Manual toggle event carrying manual_toggle_reason shows the reason as the
  // summary under the pill, needed so users see why the chat switched to Human.
  it("renders the manual toggle reason under the Manual Toggle pill", () => {
    render(
      <ConversationMessageItem
        message={buildThreadEventMessage({
          thread_event: "manual_toggle_human",
          manual_toggle_reason: "You replied from the app",
        })}
        {...baseProps}
      />,
    );

    expect(screen.getByText("Manual Toggle")).toBeInTheDocument();
    expect(screen.getByText("You replied from the app")).toBeInTheDocument();
  });

  // Legacy manual toggle events have no reason metadata → pill only, no stale
  // or duplicated summary text.
  it("renders no summary for manual toggle events without a reason", () => {
    render(
      <ConversationMessageItem
        message={buildThreadEventMessage({
          thread_event: "manual_toggle_human",
        })}
        {...baseProps}
      />,
    );

    expect(screen.getByText("Manual Toggle")).toBeInTheDocument();
    expect(screen.queryByText("You replied from the app")).not.toBeInTheDocument();
  });

  // Handoff events keep their existing summary source (handoff_tool_reason) —
  // guards against the new manual_toggle branch leaking into handoff events.
  it("still renders handoff_tool_reason for handoff events", () => {
    render(
      <ConversationMessageItem
        message={buildThreadEventMessage({
          thread_event: "handoff_to_human",
          handoff_tool_reason: "Customer asked for a human agent",
        })}
        {...baseProps}
      />,
    );

    expect(screen.getByText("Human handoff")).toBeInTheDocument();
    expect(
      screen.getByText("Customer asked for a human agent"),
    ).toBeInTheDocument();
  });
});
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

function buildAiMessage(metadata: Record<string, unknown>): ConversationMessage {
  return {
    id: "msg-ai-1",
    role: "assistant",
    content: "Draft reply",
    created_at: "2026-09-23T10:00:00.000Z",
    metadata,
    outgoing_sender_type: "ai_agent",
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

  // Agent errors are operator-only: the pill plus the stored error must show so
  // operators know why no AI reply was sent while the customer saw nothing.
  it("renders the stored error under the AI error pill", () => {
    render(
      <ConversationMessageItem
        message={buildThreadEventMessage({
          thread_event: "agent_error",
          agent_error_message: "OpenRouter request failed",
        })}
        {...baseProps}
      />,
    );

    expect(screen.getByText("AI error")).toBeInTheDocument();
    expect(screen.getByText("OpenRouter request failed")).toBeInTheDocument();
  });

  // A dry-run draft is an AI reply that was never sent: operators must see the
  // "Dry run · Not sent" label so it is never mistaken for a delivered reply.
  it("labels a dry-run draft as not sent", () => {
    render(
      <ConversationMessageItem
        message={buildAiMessage({ source: "agent_dry_run", dry_run: true })}
        {...baseProps}
      />,
    );

    expect(screen.getByText("Dry run · Not sent")).toBeInTheDocument();
    expect(screen.getByText("Draft reply")).toBeInTheDocument();
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
  });

  // A regular AI reply keeps its "AI" label, guarding against the dry-run branch
  // leaking into live AI messages.
  it("labels a live AI reply as AI", () => {
    render(<ConversationMessageItem message={buildAiMessage({})} {...baseProps} />);

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.queryByText("Dry run · Not sent")).not.toBeInTheDocument();
  });

  // Would-hand-off notes from a dry run must be operator-visible without implying
  // the live conversation actually switched to human handling.
  it("renders a dry-run would-hand-off pill", () => {
    render(
      <ConversationMessageItem
        message={buildThreadEventMessage({
          thread_event: "handoff_to_human",
          handoff_tool_reason: "Customer asked for a person",
          dry_run: true,
        })}
        {...baseProps}
      />,
    );

    expect(screen.getByText("Dry run · would hand off")).toBeInTheDocument();
    expect(screen.getByText("Customer asked for a person")).toBeInTheDocument();
  });
});
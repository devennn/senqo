import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageComposerAiHandled } from "@/pages/dashboard/components/message-composer-ai-handled";

const line = {
  id: "conn-1",
  displayName: "Line",
  phoneNumber: null,
  mode: "dry_run" as const,
};

describe("MessageComposerAiHandled", () => {
  // On a dry-run line the composer must say replies are drafted, not sent, so
  // operators never assume the customer is being answered.
  it("shows the dry-run note when the line is in dry_run mode", () => {
    render(
      <MessageComposerAiHandled
        connectionUnavailable={false}
        showAiDisabledNote={false}
        whatsappConnection={line}
        canChangeHandlingMode={false}
        handlingModeSaving={false}
      />,
    );

    expect(
      screen.getByText(
        "Dry run — AI replies are drafted here but not sent to the customer.",
      ),
    ).toBeInTheDocument();
  });

  // A live line keeps the existing automatic-reply copy, guarding against the
  // dry-run note leaking into live conversations.
  it("keeps the automatic reply note for live lines", () => {
    render(
      <MessageComposerAiHandled
        connectionUnavailable={false}
        showAiDisabledNote={false}
        whatsappConnection={{ ...line, mode: "live" }}
        canChangeHandlingMode={false}
        handlingModeSaving={false}
      />,
    );

    expect(screen.getByText("AI is replying automatically...")).toBeInTheDocument();
  });
});

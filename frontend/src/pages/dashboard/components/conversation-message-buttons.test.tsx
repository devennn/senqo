import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConversationMessageButtons } from "@/pages/dashboard/components/conversation-message-buttons";

describe("ConversationMessageButtons", () => {
  // Operators must see which interactive buttons an outbound message carried,
  // otherwise the thread text alone looks like a plain message.
  it("renders one chip per button label", () => {
    render(
      <ConversationMessageButtons
        buttons={[
          { type: "quick_reply", label: "Yes", value: "yes" },
          { type: "cta_url", label: "Docs", value: "https://example.com" },
        ]}
      />,
    );

    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Docs")).toBeInTheDocument();
  });

  // Messages without buttons (or malformed metadata) must render nothing —
  // no empty chip container in every bubble.
  it("renders nothing for non-array or label-less values", () => {
    const { container: fromString } = render(<ConversationMessageButtons buttons="nope" />);
    expect(fromString.querySelector('[data-testid="message-buttons"]')).not.toBeInTheDocument();

    const { container: fromBadItems } = render(
      <ConversationMessageButtons buttons={[{ type: "quick_reply" }, null, 3]} />,
    );
    expect(fromBadItems.querySelector('[data-testid="message-buttons"]')).not.toBeInTheDocument();
  });
});

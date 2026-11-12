import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ButtonTemplateEntryFields } from "@/pages/dashboard/components/button-template-entry-fields";
import type { ButtonTemplateButton } from "@/types/repositories";

function Harness({
  initialButtons,
  clearReplyIdOnLabelClear = false,
}: {
  initialButtons?: ButtonTemplateButton[];
  clearReplyIdOnLabelClear?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [buttons, setButtons] = useState<ButtonTemplateButton[]>(
    initialButtons ?? [{ type: "quick_reply", label: "", value: "" }],
  );

  return (
    <ButtonTemplateEntryFields
      idPrefix="btp-test"
      title={title}
      body={body}
      buttons={buttons}
      onChangeTitle={setTitle}
      onChangeBody={setBody}
      onChangeButtons={setButtons}
      clearReplyIdOnLabelClear={clearReplyIdOnLabelClear}
    />
  );
}

describe("ButtonTemplateEntryFields", () => {
  // Authors write the message text and see it appear in the customer preview,
  // so what they type is what WhatsApp will show.
  it("mirrors typed message text into the preview", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Message text"), "Confirm your booking?");

    expect(
      screen.getByText("Confirm your booking?", { selector: "p" }),
    ).toBeInTheDocument();
  });

  // Button labels typed into a row must show up in the preview, and the label
  // input is capped at the WhatsApp button-title length.
  it("shows the button label in the preview", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Label"), "Yes");

    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByLabelText("Label")).toHaveAttribute("maxlength", "40");
  });

  // WhatsApp allows at most three buttons; the add control must disable at the
  // cap so authors cannot build a message the service will reject.
  it("disables Add button at the three-button cap", () => {
    render(
      <Harness
        initialButtons={[
          { type: "quick_reply", label: "One", value: "1" },
          { type: "quick_reply", label: "Two", value: "2" },
          { type: "quick_reply", label: "Three", value: "3" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /Add button/ })).toBeDisabled();
    expect(screen.getByText("(3/3)")).toBeInTheDocument();
  });

  // Quick-reply ids are derived from the label so authors do not hand-type a
  // slug for every button.
  it("fills the reply id from the label", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Label"), "Yes please!");

    expect(screen.getByLabelText("Reply id")).toHaveValue("yes_please");
  });

  // A hand-edited reply id is an explicit choice: later label edits must not
  // overwrite it.
  it("keeps a manually edited reply id when the label changes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Label"), "Yes");
    await user.clear(screen.getByLabelText("Reply id"));
    await user.type(screen.getByLabelText("Reply id"), "confirm_yes");
    await user.type(screen.getByLabelText("Label"), " please");

    expect(screen.getByLabelText("Reply id")).toHaveValue("confirm_yes");
  });

  // New-template flow: deleting the label again must also drop the id that was
  // auto-filled from it, so no stale id is saved.
  it("clears the auto-filled reply id when the label is deleted", async () => {
    const user = userEvent.setup();
    render(<Harness clearReplyIdOnLabelClear />);

    await user.type(screen.getByLabelText("Label"), "Yes");
    expect(screen.getByLabelText("Reply id")).toHaveValue("yes");

    await user.clear(screen.getByLabelText("Label"));
    expect(screen.getByLabelText("Reply id")).toHaveValue("");
  });

  // Edit flow: ids already saved in the database are never wiped just because
  // the label was cleared while retyping.
  it("keeps a saved reply id when the label is cleared", async () => {
    const user = userEvent.setup();
    render(
      <Harness initialButtons={[{ type: "quick_reply", label: "Yes", value: "yes" }]} />,
    );

    await user.clear(screen.getByLabelText("Label"));

    expect(screen.getByLabelText("Reply id")).toHaveValue("yes");
  });

  // Only quick replies derive their value from the label; URL values stay as
  // typed so a label like "Docs" never becomes a broken link.
  it("does not fill the value for a link button", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.selectOptions(screen.getByLabelText("Type"), "cta_url");
    await user.type(screen.getByLabelText("Label"), "Docs");

    expect(screen.getByLabelText("URL")).toHaveValue("");
  });

  // Removing a row drops that button from the editor and preview.
  it("removes a button row", async () => {
    const user = userEvent.setup();
    render(<Harness initialButtons={[{ type: "quick_reply", label: "Yes", value: "yes" }]} />);

    await user.click(screen.getByRole("button", { name: "Remove button 1" }));

    expect(screen.queryByLabelText("Label")).not.toBeInTheDocument();
    expect(screen.queryByText("Yes")).not.toBeInTheDocument();
  });
});

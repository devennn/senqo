import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiKeysManagerCard } from "@/pages/settings/components/api-keys-manager-card";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultProps(overrides = {}) {
  return {
    items: [],
    creating: false,
    revokingId: null,
    createResult: null,
    clearCreateResult: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ApiKeysManagerCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Empty list shows placeholder — prevents blank card body.
  it("shows empty state when no API keys exist", () => {
    render(<ApiKeysManagerCard {...defaultProps()} />);
    expect(screen.getByText("No API keys created yet.")).toBeInTheDocument();
  });

  // Existing keys render with their label and prefix visible.
  it("renders existing API key rows", () => {
    render(
      <ApiKeysManagerCard
        {...defaultProps({
          items: [
            {
              id: "k1",
              label: "CI Key",
              keyPrefix: "sk_",
              expiresAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        })}
      />,
    );
    expect(screen.getByText("CI Key")).toBeInTheDocument();
    expect(screen.getByText(/Prefix: sk_/)).toBeInTheDocument();
  });

  // "Create API key" button toggles the create form open.
  // Verifies the form is not rendered until the user explicitly opens it.
  it("opens create form when Create API key button is clicked", async () => {
    const user = userEvent.setup();
    render(<ApiKeysManagerCard {...defaultProps()} />);

    expect(screen.queryByLabelText("Label")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create API key" }));
    expect(screen.getByLabelText("Label")).toBeInTheDocument();
  });

  // Submit button is disabled until a label is entered — prevents blank-label submissions.
  // When the form is open there are two "Create API key" buttons: the header toggle (index 0)
  // and the form submit (index 1). We target the submit explicitly.
  it("keeps Create API key submit button disabled until label is filled", async () => {
    const user = userEvent.setup();
    render(<ApiKeysManagerCard {...defaultProps()} />);

    await user.click(screen.getByRole("button", { name: "Create API key" }));
    const [, submitBtn] = screen.getAllByRole("button", {
      name: "Create API key",
    });
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByLabelText("Label"), "My Key");
    expect(submitBtn).not.toBeDisabled();
  });

  // Submitting the form calls onCreate with the trimmed label and null expiresAt.
  // Verifies the correct payload reaches the hook when no expiry is set.
  it("calls onCreate with label and null expiresAt on submit", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ApiKeysManagerCard {...defaultProps({ onCreate })} />);

    await user.click(screen.getByRole("button", { name: "Create API key" }));
    await user.type(screen.getByLabelText("Label"), "My Key");
    const [, submitBtn] = screen.getAllByRole("button", {
      name: "Create API key",
    });
    await user.click(submitBtn);

    expect(onCreate).toHaveBeenCalledWith({ label: "My Key", expiresAt: null });
  });

  // After submission the label input is cleared — prevents duplicate submissions.
  it("clears label input after successful create", async () => {
    const user = userEvent.setup();
    render(<ApiKeysManagerCard {...defaultProps()} />);

    await user.click(screen.getByRole("button", { name: "Create API key" }));
    await user.type(screen.getByLabelText("Label"), "Temp Key");
    const [, submitBtn] = screen.getAllByRole("button", {
      name: "Create API key",
    });
    await user.click(submitBtn);

    expect(screen.getByLabelText("Label")).toHaveValue("");
  });

  // When createResult is set, the raw key is shown with a "copy now" warning.
  // Verifies the one-time reveal pattern — the key is only shown at this moment.
  it("shows created key and warning when createResult is provided", async () => {
    const user = userEvent.setup();
    render(
      <ApiKeysManagerCard
        {...defaultProps({
          createResult: {
            apiKey: "sk_abc123xyz",
            label: "My Key",
            expiresAt: null,
            keyPrefix: "sk_",
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create API key" }));
    expect(screen.getByText(/it will not be shown again/i)).toBeInTheDocument();
    expect(screen.getByText("sk_abc123xyz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  // Clicking Close calls clearCreateResult and hides the panel.
  // Verifies the user can dismiss the key reveal and return to the list.
  it("calls clearCreateResult when Close is clicked after key reveal", async () => {
    const clearCreateResult = vi.fn();
    const user = userEvent.setup();
    render(
      <ApiKeysManagerCard
        {...defaultProps({
          createResult: {
            apiKey: "sk_abc123xyz",
            label: "My Key",
            expiresAt: null,
            keyPrefix: "sk_",
          },
          clearCreateResult,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create API key" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(clearCreateResult).toHaveBeenCalled();
  });

  // Delete button calls onDelete with the correct key id.
  it("calls onDelete with key id when Delete is clicked", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ApiKeysManagerCard
        {...defaultProps({
          items: [
            {
              id: "k1",
              label: "Old Key",
              keyPrefix: "sk_",
              expiresAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
          onDelete,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("k1");
  });

  // Submit button shows "Creating..." and is disabled while creating is true.
  // Verifies the in-flight state prevents double-submissions.
  it("disables submit and shows Creating... while creating is in progress", async () => {
    const user = userEvent.setup();
    render(<ApiKeysManagerCard {...defaultProps({ creating: true })} />);

    await user.click(screen.getByRole("button", { name: "Create API key" }));
    await user.type(screen.getByLabelText("Label"), "Key");

    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });
});

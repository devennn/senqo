import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstanceAdminAiChatSection } from "./instance-admin-ai-chat";

const mockUseAdminAiChat = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAdminAiChat", () => ({
  useAdminAiChat: mockUseAdminAiChat,
}));

beforeEach(() => {
  mockUseAdminAiChat.mockReset();
  mockUseAdminAiChat.mockReturnValue({
    messages: [],
    loading: false,
    sending: false,
    error: null,
    send: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  });
});

describe("InstanceAdminAiChatSection", () => {
  // The admin opens the chat with stored history → past messages are rendered
  // in order so the conversation continues where it left off.
  it("renders stored messages", () => {
    mockUseAdminAiChat.mockReturnValue({
      messages: [
        {
          id: "m1",
          role: "user",
          content: "How many workspaces do I have?",
          created_at: "2026-10-29T08:00:00.000Z",
        },
        {
          id: "m2",
          role: "assistant",
          content: "You have 3 workspaces.",
          created_at: "2026-10-29T08:00:05.000Z",
        },
      ],
      loading: false,
      sending: false,
      error: null,
      send: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    });

    render(<InstanceAdminAiChatSection />);

    expect(screen.getByText("How many workspaces do I have?")).toBeInTheDocument();
    expect(screen.getByText("You have 3 workspaces.")).toBeInTheDocument();
  });

  // The admin types a question and sends it → the hook's send is called with
  // the message and the input is cleared, so the next message starts fresh.
  it("sends a typed message and clears the input", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    mockUseAdminAiChat.mockReturnValue({
      messages: [],
      loading: false,
      sending: false,
      error: null,
      send,
      clear: vi.fn().mockResolvedValue(undefined),
    });
    const user = userEvent.setup();
    render(<InstanceAdminAiChatSection />);

    await user.type(screen.getByLabelText("Message"), "How many users do I have?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith("How many users do I have?");
    });
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  // The send button is disabled while the assistant is replying → the admin
  // cannot double-submit while waiting.
  it("disables sending while the assistant is replying", async () => {
    mockUseAdminAiChat.mockReturnValue({
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Hello",
          created_at: "2026-10-29T08:00:00.000Z",
        },
      ],
      loading: false,
      sending: true,
      error: null,
      send: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    });
    render(<InstanceAdminAiChatSection />);

    expect(screen.getByRole("button", { name: /Thinking/i })).toBeDisabled();
  });

  // A failed request is surfaced as an error message so the admin knows the
  // question was not answered.
  it("shows the error message returned by the hook", () => {
    mockUseAdminAiChat.mockReturnValue({
      messages: [],
      loading: false,
      sending: false,
      error: "empty reply",
      send: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    });

    render(<InstanceAdminAiChatSection />);

    expect(screen.getByText("empty reply")).toBeInTheDocument();
  });
});

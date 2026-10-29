import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAdminAiChat } from "./useAdminAiChat";

const mockFetch = vi.hoisted(() => vi.fn());
const mockSend = vi.hoisted(() => vi.fn());
const mockClear = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin-api", () => ({
  fetchAdminAiMessages: mockFetch,
  sendAdminAiChat: mockSend,
  clearAdminAiMessages: mockClear,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAdminAiChat", () => {
  // Stored history loads on mount so the chat shows the saved conversation.
  it("loads messages on mount", async () => {
    mockFetch.mockResolvedValue([
      { id: "m1", role: "user", content: "Hello", created_at: "2026-10-29T08:00:00.000Z" },
    ]);

    const { result } = renderHook(() => useAdminAiChat());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
  });

  // A failed history load is surfaced as an error and the chat still renders.
  it("exposes a load failure as an error", async () => {
    mockFetch.mockRejectedValue(new Error("unexpected error"));

    const { result } = renderHook(() => useAdminAiChat());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("unexpected error");
  });

  // A sent question is appended optimistically, then the assistant reply is
  // appended after the request resolves.
  it("appends the sent question and the assistant reply", async () => {
    mockFetch.mockResolvedValue([]);
    mockSend.mockResolvedValue({ reply: "You have 3 workspaces." });

    const { result } = renderHook(() => useAdminAiChat());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.send("How many workspaces do I have?");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe("How many workspaces do I have?");
    expect(result.current.messages[1].content).toBe("You have 3 workspaces.");
    expect(mockSend).toHaveBeenCalledWith("How many workspaces do I have?");
  });

  // A failed send removes the optimistic question so the chat reflects reality.
  it("removes the optimistic message when the send fails", async () => {
    mockFetch.mockResolvedValue([]);
    mockSend.mockRejectedValue(new Error("unexpected error"));

    const { result } = renderHook(() => useAdminAiChat());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.send("Hello");
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBe("unexpected error");
  });

  // Clearing deletes the stored history and empties the chat.
  it("clears all messages", async () => {
    mockFetch.mockResolvedValue([
      { id: "m1", role: "user", content: "Hello", created_at: "2026-10-29T08:00:00.000Z" },
    ]);
    mockClear.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAdminAiChat());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.clear();
    });

    expect(result.current.messages).toHaveLength(0);
  });
});

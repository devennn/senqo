import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet },
}));

const { useContactOptions } = await import("@/hooks/useContactOptions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useContactOptions", () => {
  // Verifies the hook fetches contact dropdown options when enabled=true and returns the list.
  // Ensures autocomplete/select fields that need contact data can populate their options on demand.
  it("fetches contact dropdown options when enabled", async () => {
    mockGet.mockResolvedValue({
      contacts: [
        { id: "c1", first_name: "Alice" },
        { id: "c2", first_name: "Bob" },
      ],
    });

    const { result } = renderHook(() => useContactOptions(true));
    await act(() => Promise.resolve());

    expect(result.current.loaded).toBe(true);
    expect(result.current.contacts).toHaveLength(2);
    expect(result.current.contacts[0].first_name).toBe("Alice");
    expect(mockGet).toHaveBeenCalledWith("/api/user/contacts/options");
  });

  // Confirms the hook skips the API call when enabled=false and returns empty/clean state.
  // Prevents unnecessary network requests for contact dropdowns that aren't visible or needed.
  it("skips fetch when enabled is false", () => {
    const { result } = renderHook(() => useContactOptions(false));

    expect(result.current.loading).toBe(false);
    expect(result.current.loaded).toBe(false);
    expect(result.current.contacts).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

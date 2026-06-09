import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: mockGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const { useContacts } = await import("@/hooks/useContacts");

beforeEach(() => { vi.clearAllMocks(); });

describe("useContacts", () => {
  it("fetches paginated contacts, returns items and total", async () => {
    mockGet.mockResolvedValue({
      contacts: [
        { id: "c1", first_name: "John", last_name: "Doe", phone: "+123", is_test: false },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const query = { page: 1, search: "", hasMetadataOnly: false, testOnly: false };
    const { result } = renderHook(() => useContacts(query));
    await act(() => Promise.resolve());
    expect(result.current.contacts).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.contacts[0].first_name).toBe("John");
  });
});

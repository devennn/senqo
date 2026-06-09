import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: mockGet, post: vi.fn(), delete: vi.fn() },
}));

const { useApiKeys } = await import("@/hooks/useApiKeys");

beforeEach(() => { vi.clearAllMocks(); });

describe("useApiKeys", () => {
  it("fetches keys and returns list", async () => {
    mockGet.mockResolvedValue({
      apiKeys: [{ id: "k1", label: "Production", keyPrefix: "sk_senqo_12", expiresAt: null, createdAt: "2025-01-01" }],
    });
    const { result } = renderHook(() => useApiKeys());
    await act(() => Promise.resolve());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].label).toBe("Production");
  });
});

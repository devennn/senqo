import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  getSession: mockGetSession,
  getAccessToken: vi.fn().mockResolvedValue(null),
}));

const { useAuth } = await import("@/hooks/useAuth");

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("useAuth", () => {
  // Confirms that when getSession returns a user object, the hook exposes it and sets loading=false.
  // Ensures authenticated users see their profile and the app doesn't redirect them to sign-in.
  it("returns user when authenticated", async () => {
    mockGetSession.mockResolvedValue({ id: "u1", email: "a@b.com" });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());
    expect(result.current.user).toEqual({ id: "u1", email: "a@b.com" });
    expect(result.current.loading).toBe(false);
  });

  // Confirms that when getSession returns null, the hook sets user=null and loading=false.
  // Ensures unauthenticated users are correctly identified so the app can redirect to sign-in.
  it("returns user null when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(() => Promise.resolve());
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

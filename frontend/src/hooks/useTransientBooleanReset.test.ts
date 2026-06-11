import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useTransientBooleanReset } from "@/hooks/useTransientBooleanReset";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("useTransientBooleanReset", () => {
  // Verifies that setting the flag to true auto-resets it to false after the specified timeout.
  // Ensures transient success banners and flash messages dismiss automatically instead of persisting.
  it("toggles and auto-resets after timeout", () => {
    const { result } = renderHook(() => {
      const [flag, setFlag] = useState(false);
      useTransientBooleanReset(flag, setFlag, 3000);
      return { flag, setFlag };
    });
    expect(result.current.flag).toBe(false);
    act(() => { result.current.setFlag(true); });
    expect(result.current.flag).toBe(true);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.flag).toBe(false);
  });
});

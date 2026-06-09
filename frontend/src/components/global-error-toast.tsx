import { useEffect, useRef } from "react";
import { toast } from "sonner";

const MESSAGE = "Something went wrong.";
const DUPLICATE_WINDOW_MS = 2500;

/**
 * Surfaces failures that bypass React render (unhandled promises, stray throws after mount).
 */
export function GlobalErrorToastListeners() {
  const lastShownAt = useRef(0);

  useEffect(() => {
    function showIfStale() {
      const now = Date.now();
      if (now - lastShownAt.current < DUPLICATE_WINDOW_MS) return;
      lastShownAt.current = now;
      toast.error(MESSAGE);
    }

    function onWindowError(event: ErrorEvent) {
      if (!event.error) return;
      if (typeof event.message === "string" && event.message.includes("ResizeObserver loop")) return;
      if (event.defaultPrevented) return;
      showIfStale();
    }

    function onUnhandledRejection() {
      showIfStale();
    }

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

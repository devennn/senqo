import { useCallback, useEffect, useState, type RefObject } from "react";
import { formatConversationMessageDateGroup } from "@/lib/format-conversation-message-time";

export const CONVERSATION_DATE_MARKER_SELECTOR = "[data-conversation-date-marker]";
const STICKY_ANCHOR_OFFSET_PX = 12;
const INLINE_DIVIDER_VISIBLE_MAX_PX = 44;

function resolveActiveDateMarker(container: HTMLElement): HTMLElement | null {
  const markers = container.querySelectorAll<HTMLElement>(CONVERSATION_DATE_MARKER_SELECTOR);
  if (markers.length === 0) return null;

  const anchorY = container.getBoundingClientRect().top + STICKY_ANCHOR_OFFSET_PX;
  let activeMarker = markers[0];

  for (const marker of markers) {
    if (marker.getBoundingClientRect().top <= anchorY) {
      activeMarker = marker;
    } else {
      break;
    }
  }

  return activeMarker;
}

function shouldShowStickyDateHeader(marker: HTMLElement, container: HTMLElement): boolean {
  const markerTop = marker.getBoundingClientRect().top - container.getBoundingClientRect().top;
  return markerTop < 0 || markerTop > INLINE_DIVIDER_VISIBLE_MAX_PX;
}

export function useConversationStickyDate(
  scrollContainerRef: RefObject<HTMLElement | null> | undefined,
  messagesFingerprint: string,
): {
  activeDateIso: string | null;
  label: string | null;
  showStickyDate: boolean;
} {
  const [activeDateIso, setActiveDateIso] = useState<string | null>(null);
  const [showStickyDate, setShowStickyDate] = useState(false);

  const updateStickyDate = useCallback(() => {
    const container = scrollContainerRef?.current;
    if (!container) {
      setActiveDateIso(null);
      setShowStickyDate(false);
      return;
    }

    const activeMarker = resolveActiveDateMarker(container);
    if (!activeMarker) {
      setActiveDateIso(null);
      setShowStickyDate(false);
      return;
    }

    const iso = activeMarker.dataset.conversationDateMarker ?? null;
    setActiveDateIso(iso);
    setShowStickyDate(iso ? shouldShowStickyDateHeader(activeMarker, container) : false);
  }, [scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    updateStickyDate();
    container.addEventListener("scroll", updateStickyDate, { passive: true });
    const resizeObserver = new ResizeObserver(updateStickyDate);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("scroll", updateStickyDate);
      resizeObserver.disconnect();
    };
  }, [scrollContainerRef, messagesFingerprint, updateStickyDate]);

  const label = activeDateIso ? formatConversationMessageDateGroup(activeDateIso) : null;
  return { activeDateIso, label, showStickyDate };
}

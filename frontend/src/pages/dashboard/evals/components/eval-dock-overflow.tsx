import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const EVAL_DOCK_PREVIEW_LINES = 4;

/** 4 lines of text-sm (0.875rem) at leading-relaxed (1.625). */
export const EVAL_DOCK_PREVIEW_MAX_HEIGHT = "calc(0.875rem * 1.625 * 4)";

export const EVAL_DOCK_PREVIEW_BODY_STYLE: CSSProperties = {
  maxHeight: EVAL_DOCK_PREVIEW_MAX_HEIGHT,
};

/** Textarea: 4 lines + py-2.5 (1.25rem). Inline style beats field-sizing-content. */
export const EVAL_DOCK_PREVIEW_TEXTAREA_STYLE: CSSProperties = {
  fieldSizing: "fixed",
  height: "calc(0.875rem * 1.625 * 4 + 1.25rem)",
  maxHeight: "calc(0.875rem * 1.625 * 4 + 1.25rem)",
  minHeight: 0,
  resize: "none",
  overflow: "hidden",
};

export const EVAL_DOCK_PREVIEW_BODY_CLASS =
  "overflow-hidden whitespace-pre-wrap text-sm leading-relaxed";

export const EVAL_DOCK_PREVIEW_BOX_CLASS = "min-h-24";

export const EVAL_DOCK_PREVIEW_TEXTAREA_CLASS = "min-h-0 text-sm";

export const EVAL_DOCK_FULL_PANE_CLASS = "max-h-[40vh] overflow-y-auto";

export const EVAL_DOCK_FULL_TEXTAREA_CLASS =
  "field-sizing-fixed min-h-32 max-h-[40vh] resize-none overflow-y-auto text-sm";

/** Soft fade so clipped lines read as more text below. */
export const EVAL_DOCK_OVERFLOW_FADE_STYLE: CSSProperties = {
  WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
  maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
};

export function textExceedsPreviewLines(text: string): boolean {
  return text.split("\n").length > EVAL_DOCK_PREVIEW_LINES;
}

export function useOverflow<T extends HTMLElement>(value: string): {
  ref: RefObject<T | null>;
  overflows: boolean;
} {
  const ref = useRef<T | null>(null);
  const [measured, setMeasured] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setMeasured(false);
      return;
    }
    setMeasured(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, value]);

  return { ref, overflows: textExceedsPreviewLines(value) || measured };
}

/** Compact bottom-right cue — matches eval Reasoning expand language. */
export function EvalDockViewCue() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-background/95 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-muted-foreground shadow-soft">
      View
      <ChevronDown className="size-3" aria-hidden strokeWidth={2} />
    </span>
  );
}

/** Truncated preview: muted fade + View chip; click opens full modal. */
export function EvalDockFadedPreview({
  overflows,
  onViewFull,
  className,
  children,
}: {
  overflows: boolean;
  onViewFull?: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (!overflows || !onViewFull) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="View full"
      className={cn(
        "relative w-full cursor-pointer rounded-sm text-left text-muted-foreground",
        "hover:opacity-90",
        className,
      )}
      onClick={onViewFull}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onViewFull();
        }
      }}
    >
      <div style={EVAL_DOCK_OVERFLOW_FADE_STYLE}>{children}</div>
      <span className="pointer-events-none absolute right-0 bottom-0">
        <EvalDockViewCue />
      </span>
    </div>
  );
}

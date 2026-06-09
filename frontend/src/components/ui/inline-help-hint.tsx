import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Accessible name for the info control (shown to screen readers). */
  label: string;
  className?: string;
  /** Supplementary explanation; keep headings/labels terse in the main UI. */
  children: React.ReactNode;
};

type Dock = { top: number; left: number; maxWidth: number };

export function InlineHelpHint({ label, className, children }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState<Dock>({ top: 8, left: 8, maxWidth: 320 });
  const [panelReady, setPanelReady] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gutter = 8;
    const maxWidth = Math.min(320, window.innerWidth - gutter * 2);
    let left = r.left;
    left = Math.max(gutter, Math.min(left, window.innerWidth - maxWidth - gutter));
    const top = r.bottom + gutter;
    setDock({ top, left, maxWidth });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelReady(false);
      return;
    }
    updatePosition();
    setPanelReady(true);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !panelReady) return;
    function onViewportChange() {
      updatePosition();
    }
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);
    return () => {
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [open, panelReady, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const panel =
    open && panelReady && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={tipId}
            role="tooltip"
            className="max-h-[min(22rem,calc(100vh-4rem))] overflow-y-auto rounded-lg border border-border bg-popover p-3 shadow-lg"
            style={{
              position: "fixed",
              top: dock.top,
              left: dock.left,
              maxWidth: dock.maxWidth,
              zIndex: 200,
            }}
          >
            <div className="space-y-2 text-xs leading-relaxed text-popover-foreground">{children}</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-slot="inline-help-trigger"
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent text-muted-foreground outline-none transition-colors hover:border-border hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-expanded:bg-muted/60",
          className,
        )}
        aria-expanded={open}
        aria-controls={tipId}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <Info className="size-4 shrink-0" aria-hidden />
      </button>
      {panel}
    </>
  );
}

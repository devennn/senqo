import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConnectionUnavailableReason } from "@/hooks/useConnections";

/** Shared pill styling for the summary strip and matching info trigger */
const amberNoticeChrome =
  "rounded-[min(var(--radius-md),12px)] border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100";

function resolveCopy(reason: ConnectionUnavailableReason): { summary: string; detail: string } {
  if (reason === "whatsapp_unavailable") {
    return {
      summary: "WhatsApp service unavailable",
      detail:
        "The WhatsApp service could not be reached. Check that it is running and WHATSAPP_SERVICE_URL is configured, then try again.",
    };
  }
  return {
    summary: "Connections unavailable",
    detail: "Connections are unavailable right now. Please contact support.",
  };
}

export function ConnectionUnavailableNotice(props: {
  reason: ConnectionUnavailableReason;
  className?: string;
}) {
  const { reason, className } = props;
  const { summary, detail } = resolveCopy(reason);

  return (
    <Popover.Root modal={false}>
      <div className={cn("inline-flex h-9 max-w-full items-center gap-1.5", className)}>
        <div
          className={cn(
            "flex h-9 min-w-0 max-w-full items-center px-3 text-sm font-semibold leading-none",
            amberNoticeChrome,
          )}
        >
          <span className="min-w-0 truncate">{summary}</span>
        </div>
        <Popover.Trigger
          openOnHover
          delay={200}
          closeDelay={150}
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={cn(
                "size-9 shrink-0 hover:border-amber-500/40 hover:bg-amber-500/15 dark:hover:border-amber-500/45 dark:hover:bg-amber-500/20",
                "focus-visible:border-amber-500/50 focus-visible:ring-amber-500/25",
                amberNoticeChrome,
              )}
              aria-label="Show full explanation"
            />
          }
        >
          <Info className="size-3.5" aria-hidden />
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup
            className={cn(
              "max-w-xs rounded-lg border border-border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-md outline-none duration-100",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <Popover.Description>{detail}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

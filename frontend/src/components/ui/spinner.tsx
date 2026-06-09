import { cn } from "@/lib/utils";
import type { PageLoaderLayout } from "@/types/ui";

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)} aria-label="Loading" role="status">
      {/* Outer ring — slow clockwise */}
      <span className="absolute size-full animate-spin rounded-full border-2 border-transparent border-t-primary/70" style={{ animationDuration: "1.4s" }} />
      {/* Middle ring — medium counter-clockwise */}
      <span className="absolute size-[70%] animate-spin rounded-full border-2 border-transparent border-t-primary" style={{ animationDuration: "0.9s", animationDirection: "reverse" }} />
      {/* Inner dot — pulse */}
      <span className="size-[28%] animate-pulse rounded-full bg-primary/80" />
    </span>
  );
}

export function PageLoader({
  label = "Loading…",
  layout = "main",
}: {
  label?: string;
  layout?: PageLoaderLayout;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-5",
        layout === "main" && "min-h-0 flex-1",
        layout === "agentTabPanel" && "min-h-[min(58vh,28rem)] w-full py-6",
      )}
    >
      <div className="relative flex items-center justify-center">
        <span className="absolute size-20 animate-ping rounded-full bg-primary/10" style={{ animationDuration: "1.8s" }} />
        <span className="relative flex size-14 items-center justify-center">
          <span className="absolute size-full animate-spin rounded-full border-[3px] border-transparent border-t-primary/60" style={{ animationDuration: "1.5s" }} />
          <span className="absolute size-[75%] animate-spin rounded-full border-[2px] border-transparent border-t-primary" style={{ animationDuration: "0.9s", animationDirection: "reverse" }} />
          <span className="absolute size-[45%] animate-spin rounded-full border-[2px] border-transparent border-t-primary/50" style={{ animationDuration: "0.6s" }} />
          <span className="size-[18%] animate-pulse rounded-full bg-primary" />
        </span>
      </div>
      <p className="animate-pulse text-sm font-medium tracking-widest text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

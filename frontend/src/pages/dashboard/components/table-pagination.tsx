import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function TablePagination({
  page,
  total,
  pageSize,
  onPage,
  compact = false,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  /** Single-row icon controls for narrow sidebars. */
  compact?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  if (compact) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <p className="min-w-0 truncate tabular-nums">
          {start}–{end} of {total}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Previous page"
            className={buttonVariants({ variant: "outline", size: "icon-xs" })}
          >
            <ChevronLeft />
          </button>
          <span className="min-w-8 text-center tabular-nums" aria-live="polite">
            {safePage}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(safePage + 1)}
            disabled={safePage >= totalPages}
            aria-label="Next page"
            className={buttonVariants({ variant: "outline", size: "icon-xs" })}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {start}–{end} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(safePage - 1)}
          disabled={safePage <= 1}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Previous
        </button>
        <span className="px-1 tabular-nums">
          Page {safePage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPage(safePage + 1)}
          disabled={safePage >= totalPages}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Next
        </button>
      </div>
    </div>
  );
}

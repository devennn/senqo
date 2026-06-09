import { buttonVariants } from "@/components/ui/button";

export function TablePagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>Showing {start}–{end} of {total}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPage(safePage - 1)}
          disabled={safePage <= 1}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Previous
        </button>
        <span className="px-1">Page {safePage} of {totalPages}</span>
        <button
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

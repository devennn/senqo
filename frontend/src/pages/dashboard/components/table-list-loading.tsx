import { Spinner } from "@/components/ui/spinner";

export function TableListLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 py-12 text-muted-foreground"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner className="size-8" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

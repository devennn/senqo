import {
  formatKnowledgeUpdatedAt,
  formatKnowledgeUpdatedAtTitle,
  isKnowledgeStale,
} from "@/lib/knowledge-updated-at";
import { cn } from "@/lib/utils";

type Props = {
  entryCount: number;
  entryMax: number;
  entryLabelSingular: string;
  entryLabelPlural: string;
  updatedAt: string | null;
  usedByNames?: string[];
  className?: string;
};

/** Compact meta row for group editor headers: count · updated · used by. */
export function KnowledgeUpdatedAtLine({
  entryCount,
  entryMax,
  entryLabelSingular,
  entryLabelPlural,
  updatedAt,
  usedByNames,
  className,
}: Props) {
  const entryLabel = entryCount === 1 ? entryLabelSingular : entryLabelPlural;
  const updatedLabel = updatedAt ? formatKnowledgeUpdatedAt(updatedAt) : null;
  const stale = updatedAt ? isKnowledgeStale(updatedAt) : false;
  const usedBy =
    usedByNames === undefined
      ? null
      : usedByNames.length === 0
        ? "Not attached to any agent"
        : usedByNames.length <= 2
          ? `Used by ${usedByNames.join(", ")}`
          : `Used by ${usedByNames.length} agents`;

  return (
    <p className={cn("flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted-foreground", className)}>
      <span className="shrink-0">
        {entryCount}/{entryMax} {entryLabel}
      </span>
      {updatedLabel ? (
        <span className="min-w-0 truncate" title={formatKnowledgeUpdatedAtTitle(updatedAt!) || undefined}>
          <span aria-hidden>· </span>
          {updatedLabel}
          {stale ? (
            <span className="text-amber-700 dark:text-amber-400"> · May be outdated</span>
          ) : null}
        </span>
      ) : null}
      {usedBy ? (
        <span
          className="min-w-0 truncate"
          title={usedByNames && usedByNames.length > 2 ? usedByNames.join(", ") : undefined}
        >
          <span aria-hidden>· </span>
          {usedBy}
        </span>
      ) : null}
    </p>
  );
}

import { cn } from "@/lib/utils";

type Props = {
  entryCount: number;
  entryMax: number;
  entryLabelSingular: string;
  entryLabelPlural: string;
  className?: string;
};

export function KnowledgeGroupListMeta({
  entryCount,
  entryMax,
  entryLabelSingular,
  entryLabelPlural,
  className,
}: Props) {
  const entryLabel = entryCount === 1 ? entryLabelSingular : entryLabelPlural;

  return (
    <p className={cn("truncate text-xs", className)}>
      {entryCount}/{entryMax} {entryLabel}
    </p>
  );
}

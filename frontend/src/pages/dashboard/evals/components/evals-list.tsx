import { EvalListItem } from "@/pages/dashboard/evals/components/eval-list-item";
import type { EvalCase } from "@/types/evals";

type Props = {
  cases: EvalCase[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function EvalsList({ cases, selectedId, onSelect }: Props) {
  if (cases.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
        No evals yet. Create one manually or capture from a conversation.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {cases.map((item) => (
        <EvalListItem
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </ul>
  );
}

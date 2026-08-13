import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvalConversationEditTurn } from "@/pages/dashboard/evals/components/eval-conversation-edit-turn";
import type { EvalTurn, EvalTurnRole } from "@/types/evals";

type Props = {
  turns: EvalTurn[];
  onSave: (turns: EvalTurn[]) => void;
  onCancel: () => void;
};

function turnsEqual(a: EvalTurn[], b: EvalTurn[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Edit mode: add/remove/reorder turns, then save back to chat view. */
export function EvalConversationEditor({ turns, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<EvalTurn[]>(turns);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(turns);
  }, [turns]);

  const dirty = !turnsEqual(draft, turns);
  const canSave =
    dirty &&
    draft.length > 0 &&
    draft.every((t) => t.content.trim().length > 0 || Boolean(t.media)) &&
    !saving;

  function updateContent(index: number, content: string): void {
    setDraft((prev) => prev.map((turn, i) => (i === index ? { ...turn, content } : turn)));
  }

  function removeTurn(index: number): void {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function addTurn(role: EvalTurnRole): void {
    setDraft((prev) => [...prev, { role, content: "" }]);
  }

  function moveTurn(index: number, direction: -1 | 1): void {
    setDraft((prev) => {
      const next = index + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Edit conversation
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="xs" onClick={() => addTurn("user")}>
            <Plus className="size-3" />
            User
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => addTurn("assistant")}>
            <Plus className="size-3" />
            AI
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={!canSave}
            onClick={() => {
              setSaving(true);
              onSave(draft.map((t) => ({ ...t, content: t.content.trim() })));
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        {draft.map((turn, index) => (
          <EvalConversationEditTurn
            key={`edit-turn-${index}`}
            turn={turn}
            index={index}
            total={draft.length}
            onContentChange={(content) => updateContent(index, content)}
            onMoveUp={() => moveTurn(index, -1)}
            onMoveDown={() => moveTurn(index, 1)}
            onRemove={() => removeTurn(index)}
          />
        ))}
        {draft.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages. Add a user or AI turn.
          </p>
        ) : null}
      </div>
    </div>
  );
}

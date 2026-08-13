import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import type { EvalCase } from "@/types/evals";

/** Compact outline size shared by Knowledge row actions (Eval / Remove). */
export const KNOWLEDGE_ROW_ACTION_BTN =
  "h-7 shrink-0 gap-1.5 px-2 text-xs";

type KnowledgeEvalKind = "template" | "context" | "handoff";

type Props = {
  kind: KnowledgeEvalKind;
  entryId: string;
  disabled?: boolean;
};

/** One-click eval from knowledge — Spec drafts conversation; expected reply/action from the entry. */
export function AddKnowledgeToEvalButton({ kind, entryId, disabled = false }: Props) {
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path =
    kind === "template"
      ? "/api/user/evals/from-template"
      : kind === "context"
        ? "/api/user/evals/from-context"
        : "/api/user/evals/from-handoff";
  const bodyKey =
    kind === "template"
      ? "templateEntryId"
      : kind === "context"
        ? "contextEntryId"
        : "handoffTopicEntryId";

  async function handleCreate(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ evalCase: EvalCase }>(path, {
        [bodyKey]: entryId,
      });
      navigate(`${wsPath("/evals")}?evalId=${res.evalCase.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create eval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={KNOWLEDGE_ROW_ACTION_BTN}
        disabled={disabled || busy}
        aria-label={`Create eval from ${kind}`}
        title={`Create eval from ${kind}`}
        onClick={() => void handleCreate()}
      >
        <FlaskConical className="size-3.5" />
        {busy ? "Creating…" : "Eval"}
      </Button>
      {error ? <p className="mt-1 max-w-[12rem] text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import type { EvalCase } from "@/types/evals";

type Props = {
  conversationId: string;
  conversationTitle: string;
};

export function AddConversationToEvalDialog({ conversationId, conversationTitle }: Props) {
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [expectedGuidance, setExpectedGuidance] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = analysis.trim().length > 0 && expectedGuidance.trim().length > 0 && !busy;

  async function handleCreate(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ evalCase: EvalCase }>("/api/user/evals/from-conversation", {
        conversationId,
        answerAnalysis: analysis.trim(),
        expectedGuidance: expectedGuidance.trim(),
      });
      setOpen(false);
      setAnalysis("");
      setExpectedGuidance("");
      navigate(`${wsPath("/evals")}?evalId=${res.evalCase.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create draft eval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2 text-xs"
            aria-label="Add to eval"
            title="Add to eval"
          />
        }
      >
        <FlaskConical className="size-3.5" />
        Eval
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add conversation to eval</DialogTitle>
          <DialogDescription>
            Describe what was wrong and what the reply should say. AI drafts the expected reply for
            review.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
            Capturing: <span className="font-semibold">{conversationTitle}</span>
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="eval-from-chat-analysis">Answer analysis</Label>
            <Textarea
              id="eval-from-chat-analysis"
              value={analysis}
              onChange={(event) => setAnalysis(event.target.value)}
              placeholder="Agent invented a 90-day refund window."
              className="min-h-20"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eval-from-chat-expected">What the reply should say</Label>
            <Textarea
              id="eval-from-chat-expected"
              value={expectedGuidance}
              onChange={(event) => setExpectedGuidance(event.target.value)}
              placeholder="Refunds are only within 14 days…"
              className="min-h-20"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => void handleCreate()}>
            {busy ? "Creating draft…" : "Create draft eval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

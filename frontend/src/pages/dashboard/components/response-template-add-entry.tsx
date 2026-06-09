import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP } from "@/lib/response-template-limits";
import { api } from "@/lib/api";

type Props = {
  groupId: string;
  atCapacity: boolean;
  onAdded: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

export function ResponseTemplateAddEntry({ groupId, atCapacity, onAdded, onWorkspaceStale }: Props) {
  const [open, setOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuestionText("");
    setAnswerText("");
    setError(null);
  }, [open]);

  const trimmedQ = questionText.trim();
  const trimmedA = answerText.trim();
  const canSubmit = trimmedQ.length > 0 && trimmedA.length > 0 && !busy && !atCapacity;

  function handleDialogOpenChange(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
  }

  async function handleAddTemplate() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/user/response-template-groups/${groupId}/entries`, {
        questionText,
        answerText,
      });
      setOpen(false);
      await Promise.resolve(onWorkspaceStale());
      await onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add template.");
    } finally {
      setBusy(false);
    }
  }

  const qId = `rtp-dialog-new-q-${groupId}`;
  const aId = `rtp-dialog-new-a-${groupId}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="button" size="sm" disabled={atCapacity} onClick={() => setOpen(true)}>
          Add template
        </Button>
        {atCapacity ? (
          <span className="text-sm text-destructive">
            This group is at its entry limit ({RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP}).
          </span>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
              <span>New template</span>
              <InlineHelpHint label="Adding a template">
                <p>
                  Enter shopper-style wording for the typical question plus the verbatim WhatsApp answer. Saves as one entry
                  in this group.
                </p>
              </InlineHelpHint>
            </DialogTitle>
            <DialogDescription>Add a question intent and reply; you can edit it later from the list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={qId} className="text-xs">
                Question
              </Label>
              <Textarea
                id={qId}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={2}
                className="min-h-[2.75rem] resize-y text-sm"
                placeholder="How they might phrase it"
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={aId} className="text-xs">
                Answer
              </Label>
              <Textarea
                id={aId}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={4}
                className="min-h-[4rem] resize-y text-sm"
                placeholder="Verbatim WhatsApp reply"
                disabled={busy}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!canSubmit} onClick={() => void handleAddTemplate()}>
                {busy ? "Adding…" : "Add template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EvalCase } from "@/types/evals";

type Props = {
  evalCase: EvalCase;
  disabled?: boolean;
  onSave: (input: { title: string; expectedReply: string }) => Promise<void>;
};

/** Edit eval title and expected reply (parallel to Create eval). */
export function EditEvalDialog({ evalCase, disabled = false, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(evalCase.title);
  const [expectedReply, setExpectedReply] = useState(evalCase.expectedReply);
  const [saving, setSaving] = useState(false);
  const isHandoff = evalCase.expectedAction === "handoff";

  useEffect(() => {
    if (!open) return;
    setTitle(evalCase.title);
    setExpectedReply(evalCase.expectedReply);
  }, [open, evalCase.id, evalCase.title, evalCase.expectedReply]);

  const dirty =
    title.trim() !== evalCase.title.trim() ||
    (!isHandoff && expectedReply.trim() !== evalCase.expectedReply.trim());
  const canSubmit =
    dirty &&
    title.trim().length > 0 &&
    (isHandoff || expectedReply.trim().length > 0) &&
    !saving;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={disabled}
            className="border-border bg-card text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          />
        }
      >
        <Pencil className="size-3.5" />
        Edit eval
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit eval</DialogTitle>
          <DialogDescription>
            {isHandoff
              ? "Update the case title. Handoff expectation stays tied to the topic."
              : "Update the case title and expected reply."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`eval-edit-title-${evalCase.id}`}>Title</Label>
            <Input
              id={`eval-edit-title-${evalCase.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          {isHandoff ? (
            <div className="grid gap-1.5">
              <Label>Expected action</Label>
              <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground">
                Hand off to a human
                {evalCase.expectedTopicLabel
                  ? ` · ${evalCase.expectedTopicLabel}`
                  : ""}
              </p>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor={`eval-edit-expected-${evalCase.id}`}>Expected reply</Label>
              <Textarea
                id={`eval-edit-expected-${evalCase.id}`}
                value={expectedReply}
                onChange={(event) => setExpectedReply(event.target.value)}
                className="min-h-24"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              void (async () => {
                setSaving(true);
                try {
                  await onSave({
                    title: title.trim(),
                    expectedReply: isHandoff
                      ? evalCase.expectedReply
                      : expectedReply.trim(),
                  });
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

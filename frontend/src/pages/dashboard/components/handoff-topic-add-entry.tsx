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
import { Input } from "@/components/ui/input";
import { HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP } from "@/lib/agent-handoff-topic-limits";
import { api } from "@/lib/api";

type Props = {
  groupId: string;
  atCapacity: boolean;
  onAdded: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

export function HandoffTopicAddEntry({ groupId, atCapacity, onAdded, onWorkspaceStale }: Props) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTopic("");
    setDescription("");
    setError(null);
  }, [open]);

  const trimmedTopic = topic.trim();
  const canSubmit = trimmedTopic.length > 0 && !busy && !atCapacity;

  function handleDialogOpenChange(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
  }

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/user/handoff-topic-groups/${groupId}/entries`, {
        topic,
        description,
      });
      setOpen(false);
      await Promise.resolve(onWorkspaceStale());
      await onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add topic.");
    } finally {
      setBusy(false);
    }
  }

  const topicId = `ho-dialog-topic-${groupId}`;
  const descId = `ho-dialog-desc-${groupId}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="button" size="sm" disabled={atCapacity} onClick={() => setOpen(true)}>
          Add topic
        </Button>
        {atCapacity ? (
          <span className="text-sm text-destructive">
            This group is at its topic limit ({HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP}).
          </span>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
              <span>New handoff topic</span>
              <InlineHelpHint label="Adding a topic">
                <p>Short trigger label plus optional detail so the model knows when to hand off and what to log.</p>
              </InlineHelpHint>
            </DialogTitle>
            <DialogDescription>Add a topic row; you can edit it later from the list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={topicId} className="text-xs">
                Topic
              </Label>
              <Input
                id={topicId}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Billing dispute"
                disabled={busy}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={descId} className="text-xs">
                Description
              </Label>
              <Textarea
                id={descId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="min-h-[4rem] resize-y text-sm"
                placeholder="When this applies and what the teammate should know."
                disabled={busy}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!canSubmit} onClick={() => void handleAdd()}>
                {busy ? "Adding…" : "Add topic"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { api } from "@/lib/api";
import { BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP } from "@/lib/button-template-limits";
import { ButtonTemplateEntryFields } from "@/pages/dashboard/components/button-template-entry-fields";
import type { ButtonTemplateButton } from "@/types/repositories";

type Props = {
  groupId: string;
  atCapacity: boolean;
  onAdded: () => Promise<void>;
  onWorkspaceStale: () => void | Promise<void>;
};

const DEFAULT_BUTTONS: ButtonTemplateButton[] = [{ type: "quick_reply", label: "", value: "" }];

export function ButtonTemplateAddEntry({ groupId, atCapacity, onAdded, onWorkspaceStale }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [buttons, setButtons] = useState<ButtonTemplateButton[]>(DEFAULT_BUTTONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setButtons(DEFAULT_BUTTONS);
    setError(null);
  }, [open]);

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    buttons.length > 0 &&
    buttons.every((button) => button.label.trim().length > 0 && button.value.trim().length > 0) &&
    !busy &&
    !atCapacity;

  function handleDialogOpenChange(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
  }

  async function handleAddTemplate() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/user/button-template-groups/${groupId}/entries`, {
        title,
        body,
        buttons,
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="button" size="sm" disabled={atCapacity} onClick={() => setOpen(true)}>
          Add template
        </Button>
        {atCapacity ? (
          <span className="text-sm text-destructive">
            This group is at its template limit ({BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP}).
          </span>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="max-h-[min(92vh,52rem)] w-full grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl"
          showCloseButton
        >
          <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
                <span>New button template</span>
                <InlineHelpHint label="About button templates">
                  <>
                    <p>
                      Name the template, write the message customers read, then add up to three buttons. The
                      agent can send this exact message when it fits the conversation.
                    </p>
                    <p>Preview below matches what WhatsApp shows.</p>
                  </>
                </InlineHelpHint>
              </DialogTitle>
              <DialogDescription>
                Write the message and buttons; you can edit them later from the list.
              </DialogDescription>
            </DialogHeader>
            <ButtonTemplateEntryFields
              idPrefix={`btp-dialog-new-${groupId}`}
              title={title}
              body={body}
              buttons={buttons}
              onChangeTitle={setTitle}
              onChangeBody={setBody}
              onChangeButtons={setButtons}
              disabled={busy}
              clearReplyIdOnLabelClear
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={() => void handleAddTemplate()}>
              {busy ? "Adding…" : "Add template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

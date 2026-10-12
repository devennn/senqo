import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pendingConfirmLabel?: string;
  isConfirming: boolean;
  onConfirm: () => void | Promise<void>;
  /** Custom rendering for a failed confirm (e.g. to name an agent and offer a link). */
  renderError?: (error: unknown) => ReactNode;
};

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  pendingConfirmLabel,
  isConfirming,
  onConfirm,
  renderError,
}: Props) {
  const [dialogError, setDialogError] = useState<unknown>(null);

  useEffect(() => {
    if (open) setDialogError(null);
  }, [open]);

  async function handleConfirm() {
    setDialogError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (caught) {
      setDialogError(caught);
    }
  }

  const confirmShown = isConfirming ? pendingConfirmLabel ?? `${confirmLabel}…` : confirmLabel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {dialogError ? (
          renderError ? (
            renderError(dialogError)
          ) : (
            <p className="text-sm text-destructive">
              {dialogError instanceof Error ? dialogError.message : "Something went wrong."}
            </p>
          )
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleConfirm()} disabled={isConfirming}>
            {confirmShown}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

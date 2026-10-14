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
  /** Keeps the confirm action unavailable (e.g. while a preflight check is still running or a delete is blocked). */
  confirmDisabled?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Extra content between the description and the error area (e.g. a preflight summary). */
  details?: ReactNode;
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
  confirmDisabled = false,
  onConfirm,
  details,
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
        {details}
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
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isConfirming || confirmDisabled}
          >
            {confirmShown}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

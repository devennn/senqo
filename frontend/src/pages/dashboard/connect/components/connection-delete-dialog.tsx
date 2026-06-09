import { ConfirmDestructiveDialog } from "@/pages/dashboard/components/confirm-destructive-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  isDeleting: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConnectionDeleteDialog({
  open,
  onOpenChange,
  displayName,
  isDeleting,
  onConfirm,
}: Props) {
  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete connection?"
      description={
        <>
          This removes <span className="font-medium text-foreground">{displayName}</span> from your
          workspace and signs out the linked WhatsApp session. Scan a new QR to connect again.
        </>
      }
      confirmLabel="Delete"
      pendingConfirmLabel="Deleting…"
      isConfirming={isDeleting}
      onConfirm={onConfirm}
    />
  );
}

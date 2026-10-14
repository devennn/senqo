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
  onConfirm: () => void;
};

/** Confirms the bulk AI summary re-run for every item in the group. */
export function AssetRerunSummariesDialog({ open, onOpenChange, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Re-run AI summaries?</DialogTitle>
          <DialogDescription>
            Every item&apos;s “what is this about” text is replaced with a fresh AI summary. Manual
            edits are overwritten.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Re-run summaries
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

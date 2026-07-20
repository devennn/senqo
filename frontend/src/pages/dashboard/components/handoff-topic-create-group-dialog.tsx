import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { HandoffTopicCreateGroupForm } from "@/pages/dashboard/components/handoff-topic-create-group-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

export function HandoffTopicCreateGroupDialog({ open, onOpenChange, onCreated }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-8">
            <span>New handoff group</span>
            <InlineHelpHint label="What is a handoff group">
              <p>
                Choose a short workspace-wide name (for example Escalations). Then add topics in the group editor after you create it.
              </p>
            </InlineHelpHint>
          </DialogTitle>
          <DialogDescription>
            Create a workspace folder for related human takeover topics.
          </DialogDescription>
        </DialogHeader>
        <HandoffTopicCreateGroupForm
          active={open}
          onSuccess={onCreated}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

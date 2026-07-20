import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentHandoffAttachPanel } from "@/pages/dashboard/components/agent-handoff-attach-panel";
import type { AgentConfigRecord, WorkspaceHandoffTopicGroupSummary } from "@/types/repositories";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: WorkspaceHandoffTopicGroupSummary | null;
  agents: AgentConfigRecord[];
  onSaved: () => Promise<void>;
};

/** Group-scoped dialog: pick agents that use this group and who to notify. */
export function AgentHandoffAttachDialog({
  open,
  onOpenChange,
  group,
  agents,
  onSaved,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 overflow-hidden sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {group?.name?.trim() ? `Handoff settings · ${group.name.trim()}` : "Handoff settings"}
          </DialogTitle>
          <DialogDescription>
            Choose which agents use this group and who gets WhatsApp alerts on handoff.
          </DialogDescription>
        </DialogHeader>
        {group ? (
          <AgentHandoffAttachPanel
            key={group.id}
            groupId={group.id}
            agents={agents}
            onSaved={onSaved}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Select a handoff group first.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentKnowledgeImportPanel } from "@/pages/dashboard/components/agent-knowledge-import-panel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  profileName: string;
  resumeJobId?: string | null;
  onApplied?: () => void;
  onCleared?: () => void;
};

export function AgentKnowledgeImportDialog({
  open,
  onOpenChange,
  agentId,
  profileName,
  resumeJobId,
  onApplied,
  onCleared,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,52rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>Import docs</DialogTitle>
          <DialogDescription>
            Draft context, skills, and templates for{" "}
            <span className="font-medium text-foreground">{profileName}</span>. Processing runs in the background —
            reopen Import docs anytime to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {open ? (
            <AgentKnowledgeImportPanel
              key={`${agentId}:${resumeJobId ?? "new"}`}
              agentId={agentId}
              profileName={profileName}
              resumeJobId={resumeJobId}
              onApplied={onApplied}
              onCleared={onCleared}
              onDone={() => onOpenChange(false)}
              onRunInBackground={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

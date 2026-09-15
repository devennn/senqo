import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EvalAnswerAnalysisPanel } from "@/pages/dashboard/evals/components/eval-answer-analysis-panel";
import { EvalExpectedReplyPanel } from "@/pages/dashboard/evals/components/eval-expected-reply-panel";

type Props = {
  open: boolean;
  onClose: () => void;
  evalCaseId: string;
  expected: string;
  onExpectedChange: (value: string) => void;
  isHandoff: boolean;
  topicLabel: string | null;
  topicDescription: string | null;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  analysis: string | null;
  running: boolean;
  answerCorrect: boolean | null;
};

export function EvalDockFullTextDialog({
  open,
  onClose,
  evalCaseId,
  expected,
  onExpectedChange,
  isHandoff,
  topicLabel,
  topicDescription,
  canSave,
  saving,
  onSave,
  analysis,
  running,
  answerCorrect,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Expected reply and answer analysis</DialogTitle>
          <DialogDescription className="sr-only">
            Full expected reply and answer analysis
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <EvalExpectedReplyPanel
            variant="full"
            evalCaseId={evalCaseId}
            expected={expected}
            onExpectedChange={onExpectedChange}
            isHandoff={isHandoff}
            topicLabel={topicLabel}
            topicDescription={topicDescription}
            canSave={canSave}
            saving={saving}
            onSave={onSave}
          />
          <EvalAnswerAnalysisPanel
            variant="full"
            analysis={analysis}
            running={running}
            answerCorrect={answerCorrect}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

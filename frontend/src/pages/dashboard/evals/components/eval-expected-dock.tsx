import { useEffect, useState } from "react";
import { EvalAnswerAnalysisPanel } from "@/pages/dashboard/evals/components/eval-answer-analysis-panel";
import { EvalDockFullTextDialog } from "@/pages/dashboard/evals/components/eval-dock-full-text-dialog";
import { EvalExpectedReplyPanel } from "@/pages/dashboard/evals/components/eval-expected-reply-panel";
import type { EvalCase } from "@/types/evals";

type Props = {
  evalCase: EvalCase;
  onSaveExpected: (id: string, expectedReply: string) => void;
  running?: boolean;
};

/** Footer: editable expected reply (left) + answer analysis (right, red/green). */
export function EvalExpectedDock({
  evalCase,
  onSaveExpected,
  running = false,
}: Props) {
  const [expected, setExpected] = useState(evalCase.expectedReply);
  const [saving, setSaving] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const isHandoff = evalCase.expectedAction === "handoff";

  useEffect(() => {
    setExpected(evalCase.expectedReply);
    setFullOpen(false);
  }, [evalCase.id, evalCase.expectedReply]);

  const dirty = expected.trim() !== evalCase.expectedReply.trim();
  const canSave = dirty && expected.trim().length > 0 && !saving && !running;

  function save(): void {
    setSaving(true);
    onSaveExpected(evalCase.id, expected);
    setSaving(false);
  }

  return (
    <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <EvalExpectedReplyPanel
          variant="preview"
          evalCaseId={evalCase.id}
          expected={expected}
          onExpectedChange={setExpected}
          isHandoff={isHandoff}
          topicLabel={evalCase.expectedTopicLabel}
          topicDescription={evalCase.expectedTopicDescription}
          canSave={canSave}
          saving={saving}
          onSave={save}
          onViewFull={() => setFullOpen(true)}
        />
        <EvalAnswerAnalysisPanel
          variant="preview"
          analysis={evalCase.answerAnalysis}
          running={running}
          answerCorrect={evalCase.answerCorrect}
          onViewFull={() => setFullOpen(true)}
        />
      </div>
      <EvalDockFullTextDialog
        open={fullOpen}
        onClose={() => setFullOpen(false)}
        evalCaseId={evalCase.id}
        expected={expected}
        onExpectedChange={setExpected}
        isHandoff={isHandoff}
        topicLabel={evalCase.expectedTopicLabel}
        topicDescription={evalCase.expectedTopicDescription}
        canSave={canSave}
        saving={saving}
        onSave={save}
        analysis={evalCase.answerAnalysis}
        running={running}
        answerCorrect={evalCase.answerCorrect}
      />
    </div>
  );
}

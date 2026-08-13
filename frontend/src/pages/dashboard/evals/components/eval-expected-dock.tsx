import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  const isHandoff = evalCase.expectedAction === "handoff";

  useEffect(() => {
    setExpected(evalCase.expectedReply);
  }, [evalCase.id, evalCase.expectedReply]);

  const dirty = expected.trim() !== evalCase.expectedReply.trim();
  const canSave = dirty && expected.trim().length > 0 && !saving && !running;
  const analysisOk = evalCase.answerCorrect === true;
  const analysisBad = evalCase.answerCorrect === false;

  return (
    <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor={`eval-expected-${evalCase.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {isHandoff ? "Expected action" : "Expected reply"}
              </label>
              <InlineHelpHint label={isHandoff ? "About expected handoff" : "About expected reply"}>
                {isHandoff ? (
                  <p>
                    This case passes when the agent calls handoff_to_human for the matching topic.
                    Reply text is optional and not scored.
                  </p>
                ) : (
                  <p>
                    AI drafts this golden reply from your guidance. Edit freely — Run eval compares
                    the agent’s answer against this text.
                  </p>
                )}
              </InlineHelpHint>
            </div>
            {!isHandoff ? (
              <Button
                type="button"
                size="xs"
                disabled={!canSave}
                onClick={() => {
                  setSaving(true);
                  onSaveExpected(evalCase.id, expected);
                  setSaving(false);
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : null}
          </div>
          {isHandoff ? (
            <div className="min-h-24 rounded-md border border-border/70 bg-muted/30 px-3.5 py-3">
              <p className="text-sm font-medium text-foreground">Hand off to a human</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Topic
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {evalCase.expectedTopicLabel?.trim() || "Configured handoff topic"}
              </p>
              {evalCase.expectedTopicDescription?.trim() ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {evalCase.expectedTopicDescription.trim()}
                </p>
              ) : null}
            </div>
          ) : (
            <Textarea
              id={`eval-expected-${evalCase.id}`}
              className="min-h-24 resize-none text-sm"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
            />
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5">
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                analysisOk && "text-emerald-700 dark:text-emerald-300",
                analysisBad && "text-destructive",
                !analysisOk && !analysisBad && "text-muted-foreground",
              )}
            >
              Answer analysis
            </p>
            <InlineHelpHint label="About answer analysis">
              <p>
                Explains whether the agent’s reply or handoff was correct and why. Green when
                correct, red when the latest run failed.
              </p>
            </InlineHelpHint>
          </div>
          <div
            className={cn(
              "min-h-24 rounded-md border px-3.5 py-3",
              analysisOk && "border-emerald-500/40 bg-emerald-500/10",
              analysisBad && "border-destructive/40 bg-destructive/10",
              !analysisOk && !analysisBad && "border-border/70 bg-muted/30",
            )}
          >
            {running ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                Running eval…
              </p>
            ) : evalCase.answerAnalysis ? (
              <p className="text-sm leading-relaxed text-foreground">{evalCase.answerAnalysis}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No analysis for this eval yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

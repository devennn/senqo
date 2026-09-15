import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { cn } from "@/lib/utils";
import {
  EVAL_DOCK_FULL_PANE_CLASS,
  EVAL_DOCK_PREVIEW_BODY_CLASS,
  EVAL_DOCK_PREVIEW_BODY_STYLE,
  EVAL_DOCK_PREVIEW_BOX_CLASS,
  EvalDockFadedPreview,
  useOverflow,
} from "@/pages/dashboard/evals/components/eval-dock-overflow";

type Props = {
  variant: "preview" | "full";
  analysis: string | null | undefined;
  running: boolean;
  answerCorrect: boolean | null | undefined;
  onViewFull?: () => void;
};

export function EvalAnswerAnalysisPanel({
  variant,
  analysis,
  running,
  answerCorrect,
  onViewFull,
}: Props) {
  const analysisOk = answerCorrect === true;
  const analysisBad = answerCorrect === false;
  const overflow = useOverflow<HTMLParagraphElement>(analysis ?? "");
  const showFade = variant === "preview" && !!analysis && !running && overflow.overflows;

  return (
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
          "rounded-md border px-3.5 py-3",
          variant === "preview" && EVAL_DOCK_PREVIEW_BOX_CLASS,
          variant === "full" && EVAL_DOCK_FULL_PANE_CLASS,
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
        ) : analysis ? (
          <EvalDockFadedPreview overflows={showFade} onViewFull={onViewFull}>
            <p
              ref={overflow.ref}
              className={cn(
                "text-sm leading-relaxed",
                showFade ? "text-muted-foreground" : "text-foreground",
                variant === "preview" && EVAL_DOCK_PREVIEW_BODY_CLASS,
                variant === "full" && "whitespace-pre-wrap",
              )}
              style={variant === "preview" ? EVAL_DOCK_PREVIEW_BODY_STYLE : undefined}
            >
              {analysis}
            </p>
          </EvalDockFadedPreview>
        ) : (
          <p className="text-sm text-muted-foreground">No analysis for this eval yet.</p>
        )}
      </div>
    </section>
  );
}

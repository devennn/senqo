import { Button } from "@/components/ui/button";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EVAL_DOCK_FULL_PANE_CLASS,
  EVAL_DOCK_FULL_TEXTAREA_CLASS,
  EVAL_DOCK_OVERFLOW_FADE_STYLE,
  EVAL_DOCK_PREVIEW_BODY_CLASS,
  EVAL_DOCK_PREVIEW_BODY_STYLE,
  EVAL_DOCK_PREVIEW_BOX_CLASS,
  EVAL_DOCK_PREVIEW_TEXTAREA_CLASS,
  EVAL_DOCK_PREVIEW_TEXTAREA_STYLE,
  EvalDockFadedPreview,
  EvalDockViewCue,
  useOverflow,
} from "@/pages/dashboard/evals/components/eval-dock-overflow";

type Props = {
  variant: "preview" | "full";
  evalCaseId: string;
  expected: string;
  onExpectedChange: (value: string) => void;
  isHandoff: boolean;
  topicLabel: string | null;
  topicDescription: string | null;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onViewFull?: () => void;
};

export function EvalExpectedReplyPanel({
  variant,
  evalCaseId,
  expected,
  onExpectedChange,
  isHandoff,
  topicLabel,
  topicDescription,
  canSave,
  saving,
  onSave,
  onViewFull,
}: Props) {
  const description = topicDescription?.trim() ?? "";
  const textareaOverflow = useOverflow<HTMLTextAreaElement>(expected);
  const descriptionOverflow = useOverflow<HTMLParagraphElement>(description);
  const overflow = isHandoff ? descriptionOverflow : textareaOverflow;
  const showFade = variant === "preview" && overflow.overflows && !!onViewFull;
  const inputId =
    variant === "full" ? `eval-expected-full-${evalCaseId}` : `eval-expected-${evalCaseId}`;

  return (
    <section className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={isHandoff ? undefined : inputId}
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
          <Button type="button" size="xs" disabled={!canSave} onClick={onSave}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {isHandoff ? (
        <div
          className={cn(
            "rounded-md border border-border/70 bg-muted/30 px-3.5 py-3",
            variant === "preview" && EVAL_DOCK_PREVIEW_BOX_CLASS,
            variant === "full" && EVAL_DOCK_FULL_PANE_CLASS,
          )}
        >
          <p className="text-sm font-medium text-foreground">Hand off to a human</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Topic
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {topicLabel?.trim() || "Configured handoff topic"}
          </p>
          {description ? (
            <EvalDockFadedPreview
              overflows={showFade}
              onViewFull={onViewFull}
              className="mt-1"
            >
              <p
                ref={descriptionOverflow.ref}
                className={cn(
                  "text-sm leading-relaxed text-muted-foreground",
                  variant === "preview" && EVAL_DOCK_PREVIEW_BODY_CLASS,
                  variant === "full" && "whitespace-pre-wrap",
                )}
                style={variant === "preview" ? EVAL_DOCK_PREVIEW_BODY_STYLE : undefined}
              >
                {description}
              </p>
            </EvalDockFadedPreview>
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <Textarea
            id={inputId}
            ref={textareaOverflow.ref}
            className={cn(
              variant === "preview" ? EVAL_DOCK_PREVIEW_TEXTAREA_CLASS : EVAL_DOCK_FULL_TEXTAREA_CLASS,
              showFade && "text-muted-foreground",
            )}
            style={{
              ...(variant === "preview" ? EVAL_DOCK_PREVIEW_TEXTAREA_STYLE : undefined),
              ...(showFade ? EVAL_DOCK_OVERFLOW_FADE_STYLE : undefined),
            }}
            value={expected}
            onChange={(event) => onExpectedChange(event.target.value)}
          />
          {showFade ? (
            <button
              type="button"
              aria-label="View full"
              className="absolute right-1.5 bottom-1.5 cursor-pointer"
              onClick={onViewFull}
            >
              <EvalDockViewCue />
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

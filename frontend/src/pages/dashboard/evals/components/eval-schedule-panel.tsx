import { Button } from "@/components/ui/button";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { useEvalSchedule } from "@/hooks/useEvalSchedule";
import { EvalScheduleForm } from "@/pages/dashboard/evals/components/eval-schedule-form";
import { EvalSuiteRunHistory } from "@/pages/dashboard/evals/components/eval-suite-run-history";

type Props = {
  evalId: string;
  onScheduleChange?: (hasSchedule: boolean) => void;
};

export function EvalSchedulePanel({ evalId, onScheduleChange }: Props) {
  const {
    draft,
    setDraft,
    members,
    created,
    enabled,
    canSubmit,
    saving,
    saved,
    submit,
    setEnabled,
    runs,
    page,
    setPage,
    total,
  } = useEvalSchedule(evalId, onScheduleChange);

  const actionLabel = !created
    ? saving
      ? "Creating…"
      : saved
        ? "Created"
        : "Create"
    : saving
      ? "Saving…"
      : saved
        ? "Saved"
        : "Save";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground">Schedule</p>
              <InlineHelpHint label="About eval schedule">
                <p>
                  Create a cadence for this eval. After that you can edit it or turn it off.
                  Email a workspace member when a scheduled run fails or errors.
                </p>
              </InlineHelpHint>
            </div>
            <Button type="button" size="xs" disabled={!canSubmit} onClick={submit}>
              {actionLabel}
            </Button>
          </div>
          {created ? (
            <div className="mb-3">
              <Button
                type="button"
                size="xs"
                variant={enabled ? "destructive" : "default"}
                disabled={saving}
                onClick={() => setEnabled(!enabled)}
              >
                {enabled ? "Turn off" : "Turn on"}
              </Button>
            </div>
          ) : null}
          <EvalScheduleForm draft={draft} members={members} onChange={setDraft} />
        </section>
        <div className="min-w-0">
          <EvalSuiteRunHistory runs={runs} page={page} total={total} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}

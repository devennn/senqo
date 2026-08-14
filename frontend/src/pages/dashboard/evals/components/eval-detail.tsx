import { useEffect, useState } from "react";
import { Loader2, Pencil, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EvalDetailTabBar,
  type EvalDetailTab,
} from "@/pages/dashboard/evals/components/eval-detail-tab-bar";
import { EditEvalDialog } from "@/pages/dashboard/evals/components/edit-eval-dialog";
import { EvalDeleteDialog } from "@/pages/dashboard/evals/components/eval-delete-dialog";
import { EvalConversationEditor } from "@/pages/dashboard/evals/components/eval-conversation-editor";
import { EvalConversationThread } from "@/pages/dashboard/evals/components/eval-conversation-thread";
import { EvalExpectedDock } from "@/pages/dashboard/evals/components/eval-expected-dock";
import { EvalRunHistory } from "@/pages/dashboard/evals/components/eval-run-history";
import { EvalSchedulePanel } from "@/pages/dashboard/evals/components/eval-schedule-panel";
import type { EvalCase, EvalTurn } from "@/types/evals";

type Props = {
  evalCase: EvalCase;
  onSaveExpected: (id: string, expectedReply: string) => void;
  onSaveTurns: (id: string, turns: EvalTurn[]) => void;
  onSaveDetails: (id: string, input: { title: string; expectedReply: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRun: (id: string) => void;
  running?: boolean;
  onScheduleChange?: (hasSchedule: boolean) => void;
};

/** Inbox-style column: chat view by default; Edit chat opens rearrange editor. */
export function EvalDetail({
  evalCase,
  onSaveExpected,
  onSaveTurns,
  onSaveDetails,
  onDelete,
  onRun,
  running = false,
  onScheduleChange,
}: Props) {
  const [tab, setTab] = useState<EvalDetailTab>("conversation");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setTab("conversation");
    setEditing(false);
  }, [evalCase.id]);

  const showEditChat = tab === "conversation" && !editing && !running;
  const showMetaActions = tab === "conversation" && !editing && !running;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
      <EvalDetailTabBar
        value={tab}
        onChange={(next) => {
          if (running) return;
          setTab(next);
          if (next !== "conversation") setEditing(false);
        }}
        trailing={
          showEditChat || showMetaActions ? (
            <>
              <Button
                type="button"
                size="xs"
                aria-label={running ? "Running eval" : "Run eval"}
                disabled={running}
                onClick={() => onRun(evalCase.id)}
              >
                {running ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Play className="size-3.5" />
                )}
                {running ? "Running…" : "Run"}
              </Button>
              {showMetaActions ? (
                <EditEvalDialog
                  evalCase={evalCase}
                  disabled={running}
                  onSave={(input) => onSaveDetails(evalCase.id, input)}
                />
              ) : null}
              {showEditChat ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="border-border bg-card text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-3.5" />
                  Edit chat
                </Button>
              ) : null}
              {showMetaActions ? (
                <EvalDeleteDialog
                  title={evalCase.title}
                  disabled={running}
                  onDelete={() => onDelete(evalCase.id)}
                />
              ) : null}
            </>
          ) : null
        }
      />

      {tab === "conversation" ? (
        <>
          <div className="min-h-0 flex-1 overflow-hidden">
            {editing ? (
              <EvalConversationEditor
                turns={evalCase.turns}
                onCancel={() => setEditing(false)}
                onSave={(turns) => {
                  onSaveTurns(evalCase.id, turns);
                  setEditing(false);
                }}
              />
            ) : (
              <EvalConversationThread
                turns={evalCase.turns}
                latestRun={evalCase.runs[0] ?? null}
                running={running}
              />
            )}
          </div>
          {!editing ? (
            <EvalExpectedDock
              evalCase={evalCase}
              onSaveExpected={onSaveExpected}
              running={running}
            />
          ) : null}
        </>
      ) : tab === "history" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <EvalRunHistory runs={evalCase.runs} />
        </div>
      ) : (
        <EvalSchedulePanel
          evalId={evalCase.id}
          onScheduleChange={onScheduleChange}
        />
      )}
    </div>
  );
}

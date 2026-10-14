import { ConversationOperatorAiReasoning } from "@/pages/dashboard/components/conversation-operator-ai-reasoning";
import type { ConversationKnowledgeRef } from "@/lib/conversation-operator-ai-reasoning";
import { cn } from "@/lib/utils";
import {
  THREAD_EVENT_AGENT_ERROR,
  THREAD_EVENT_HANDOFF_TO_HUMAN,
  THREAD_EVENT_MANUAL_TOGGLE,
  type ConversationThreadEventType,
} from "@/lib/conversation-thread-events";

function getThreadEventLabel(
  eventType: ConversationThreadEventType,
  dryRun: boolean,
): string {
  if (eventType === THREAD_EVENT_MANUAL_TOGGLE) return "Manual Toggle";
  if (eventType === THREAD_EVENT_HANDOFF_TO_HUMAN) {
    return dryRun ? "Dry run · would hand off" : "Human handoff";
  }
  if (eventType === THREAD_EVENT_AGENT_ERROR) {
    return dryRun ? "Dry run · AI error" : "AI error";
  }
  return "Event";
}

export function ConversationThreadEvent({
  eventType,
  summaryText,
  reasoningText,
  sources = [],
  dryRun = false,
}: {
  eventType: ConversationThreadEventType;
  summaryText: string | null;
  reasoningText: string | null;
  sources?: ConversationKnowledgeRef[];
  /** Operator-only note recorded during a Dry run; nothing happened to the live conversation. */
  dryRun?: boolean;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/70" />
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase",
            dryRun
              ? "border-dashed border-border bg-muted/40"
              : "border-border/80 bg-muted/60",
          )}
        >
          {getThreadEventLabel(eventType, dryRun)}
        </span>
        <div className="h-px flex-1 bg-border/70" />
      </div>
      {summaryText ? (
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {summaryText}
        </p>
      ) : null}
      {reasoningText || sources.length > 0 ? (
        <div className="mt-2">
          <ConversationOperatorAiReasoning
            text={reasoningText}
            sources={sources}
            alignEnd={false}
          />
        </div>
      ) : null}
    </div>
  );
}

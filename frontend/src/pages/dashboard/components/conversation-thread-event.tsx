import { ConversationOperatorAiReasoning } from "@/pages/dashboard/components/conversation-operator-ai-reasoning";
import {
  THREAD_EVENT_HANDOFF_TO_HUMAN,
  THREAD_EVENT_MANUAL_TOGGLE,
  type ConversationThreadEventType,
} from "@/lib/conversation-thread-events";

function getThreadEventLabel(eventType: ConversationThreadEventType): string {
  if (eventType === THREAD_EVENT_MANUAL_TOGGLE) return "Manual Toggle";
  if (eventType === THREAD_EVENT_HANDOFF_TO_HUMAN) return "Human handoff";
  return "Event";
}

export function ConversationThreadEvent({
  eventType,
  summaryText,
  reasoningText,
}: {
  eventType: ConversationThreadEventType;
  summaryText: string | null;
  reasoningText: string | null;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/70" />
        <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/60 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {getThreadEventLabel(eventType)}
        </span>
        <div className="h-px flex-1 bg-border/70" />
      </div>
      {summaryText ? (
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {summaryText}
        </p>
      ) : null}
      {reasoningText ? (
        <div className="mt-2">
          <ConversationOperatorAiReasoning text={reasoningText} alignEnd={false} />
        </div>
      ) : null}
    </div>
  );
}

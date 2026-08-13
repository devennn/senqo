import { Loader2 } from "lucide-react";
import { ConversationMessageItem } from "@/pages/dashboard/components/conversation-message-item";
import { EvalReplyInsight } from "@/pages/dashboard/evals/components/eval-reply-insight";
import type { EvalRun } from "@/types/evals";
import type { ConversationMessage } from "@/types/repositories";

const EMPTY_ORDER = new Map<string, number>();
const EMPTY_LOOKUP = new Map<string, string>();

type Props = {
  run: EvalRun | null;
  running: boolean;
  previousMessage: ConversationMessage | null;
};

function runToMessage(run: EvalRun): ConversationMessage {
  const isError = run.status === "error";
  let content: string;
  if (isError) {
    content = run.errorMessage?.trim() || "Run failed with an unexpected error.";
  } else if (run.handoffCalled) {
    const topic = run.handoffTopicLabel?.trim();
    const reply = run.actualReply.trim();
    const handoffLine = topic ? `Human handoff · ${topic}` : "Human handoff";
    content = reply ? `${handoffLine}\n\n${reply}` : handoffLine;
  } else {
    content = run.actualReply.trim() || "(empty reply)";
  }
  return {
    id: `eval-run-${run.id}`,
    role: "assistant",
    content,
    created_at: run.ranAt,
    metadata: null,
    outgoing_sender_type: "ai_agent",
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
  };
}

function renderMessage(
  message: ConversationMessage,
  previousMessage: ConversationMessage | null,
) {
  return (
    <ConversationMessageItem
      message={message}
      previousMessage={previousMessage}
      nextMessage={null}
      groupParticipantColorOrderByKey={EMPTY_ORDER}
      quotedParticipantDisplayLookup={EMPTY_LOOKUP}
      whatsappExternalIdLookup={EMPTY_LOOKUP}
      flashingMessageId={null}
      onQuoteNavigate={() => undefined}
    />
  );
}

/** Latest run as a normal AI chat bubble, with analysis in the insight UI below. */
export function EvalLatestRunBubble({ run, running, previousMessage }: Props) {
  if (running) {
    const message: ConversationMessage = {
      id: "eval-run-running",
      role: "assistant",
      content: "Running eval…",
      created_at: new Date().toISOString(),
      metadata: null,
      outgoing_sender_type: "ai_agent",
      whatsapp_sender_chat_id: null,
      whatsapp_sender_name: null,
      media: null,
    };
    return (
      <div aria-live="polite" aria-busy="true">
        {renderMessage(message, previousMessage)}
        <div className="-mt-3 mb-5 flex flex-row-reverse gap-3">
          <div className="size-8 shrink-0" aria-hidden />
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Subject agent is generating a reply…
          </div>
        </div>
      </div>
    );
  }

  if (!run) return null;

  const reasoning = run.reasoningForOperators?.trim() || null;
  const handoffSources =
    run.handoffCalled && run.handoffTopicLabel?.trim()
      ? [{ kind: "handoff" as const, label: run.handoffTopicLabel.trim() }]
      : run.handoffCalled
        ? [{ kind: "handoff" as const, label: "Human handoff" }]
        : undefined;

  return (
    <div aria-live="polite">
      {renderMessage(runToMessage(run), previousMessage)}
      <EvalReplyInsight
        reasoning={reasoning}
        sources={handoffSources}
        runStatus={run.status}
      />
    </div>
  );
}

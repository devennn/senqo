import { useEffect, useRef } from "react";
import { ConversationMessageItem } from "@/pages/dashboard/components/conversation-message-item";
import { EvalLatestRunBubble } from "@/pages/dashboard/evals/components/eval-latest-run-bubble";
import { EvalReplyInsight } from "@/pages/dashboard/evals/components/eval-reply-insight";
import type { EvalRun, EvalTurn } from "@/types/evals";
import type { ConversationMessage } from "@/types/repositories";

const EMPTY_ORDER = new Map<string, number>();
const EMPTY_LOOKUP = new Map<string, string>();

/** Scenario ends on the customer ask; subject reply comes from latest run / running bubble. */
function scenarioTurns(turns: EvalTurn[]): EvalTurn[] {
  let end = turns.length;
  while (end > 0 && turns[end - 1]?.role === "assistant") {
    end -= 1;
  }
  return end === turns.length ? turns : turns.slice(0, end);
}

function turnsToMessages(turns: EvalTurn[]): ConversationMessage[] {
  const base = Date.now() - turns.length * 60_000;
  return turns.map((turn, index) => ({
    id: `eval-msg-${index}`,
    role: turn.role === "user" ? "user" : "assistant",
    content: turn.content,
    created_at: new Date(base + index * 60_000).toISOString(),
    metadata: null,
    outgoing_sender_type: turn.role === "assistant" ? "ai_agent" : null,
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: turn.media ?? null,
  }));
}

type Props = {
  turns: EvalTurn[];
  latestRun?: EvalRun | null;
  running?: boolean;
};

/** Read-only chat transcript (user left, AI right) plus latest run result. */
export function EvalConversationThread({
  turns,
  latestRun = null,
  running = false,
}: Props) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const displayTurns = scenarioTurns(turns);
  const messages = turnsToMessages(displayTurns);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight;
    };

    scrollToBottom();
    const animationFrame = requestAnimationFrame(scrollToBottom);
    const timeout = window.setTimeout(scrollToBottom, 120);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [turns, latestRun, running]);

  return (
    <div
      ref={scrollContainerRef}
      className="bg-chat-thread h-full min-h-0 overflow-y-auto px-4 py-4 sm:px-6"
    >
      {displayTurns.map((turn, index) => (
        <div key={`eval-turn-${index}`}>
          <ConversationMessageItem
            message={messages[index]}
            previousMessage={messages[index - 1] ?? null}
            nextMessage={messages[index + 1] ?? null}
            groupParticipantColorOrderByKey={EMPTY_ORDER}
            quotedParticipantDisplayLookup={EMPTY_LOOKUP}
            whatsappExternalIdLookup={EMPTY_LOOKUP}
            flashingMessageId={null}
            onQuoteNavigate={() => undefined}
          />
          {turn.role === "assistant" ? (
            <EvalReplyInsight reasoning={turn.whyReply} sources={turn.sources} />
          ) : null}
        </div>
      ))}
      <EvalLatestRunBubble
        run={running ? null : latestRun}
        running={running}
        previousMessage={messages[messages.length - 1] ?? null}
      />
    </div>
  );
}

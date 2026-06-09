import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Bot, Loader2 } from "lucide-react";
import { buildWhatsappInboundParticipantDisplayLookup } from "@/lib/conversation-quoted-preview";
import {
  buildWhatsappExternalMessageIdLookup,
  scrollToConversationMessage,
} from "@/lib/conversation-quoted-scroll";
import { buildGroupParticipantColorOrderMap } from "@/lib/group-participant-color";
import { isSameConversationMessageDay } from "@/lib/format-conversation-message-time";
import { useConversationStickyDate } from "@/hooks/use-conversation-sticky-date";
import { ConversationMessageDateDivider } from "@/pages/dashboard/components/conversation-message-date-divider";
import { ConversationMessageItem } from "@/pages/dashboard/components/conversation-message-item";
import { ConversationMessageStickyDate } from "@/pages/dashboard/components/conversation-message-sticky-date";
import type { ConversationMessage } from "@/types/repositories";

const QUOTED_TARGET_FLASH_MS = 1600;

export function ConversationMessageList({
  messages,
  scrollContainerRef,
  hasMoreOlderMessages = false,
  loadingOlderMessages = false,
  onLoadOlderMessages,
}: {
  messages: ConversationMessage[];
  scrollContainerRef?: RefObject<HTMLElement | null>;
  hasMoreOlderMessages?: boolean;
  loadingOlderMessages?: boolean;
  onLoadOlderMessages?: () => void;
}) {
  const groupParticipantColorOrderByKey = buildGroupParticipantColorOrderMap(messages);
  const quotedParticipantDisplayLookup = buildWhatsappInboundParticipantDisplayLookup(messages);
  const whatsappExternalIdLookup = useMemo(
    () => buildWhatsappExternalMessageIdLookup(messages),
    [messages],
  );
  const [flashingMessageId, setFlashingMessageId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesFingerprint =
    messages.length > 0
      ? `${messages.length}:${messages[0]?.id}:${messages[messages.length - 1]?.id}`
      : "empty";
  const { activeDateIso, label: stickyDateLabel, showStickyDate } = useConversationStickyDate(
    scrollContainerRef,
    messagesFingerprint,
  );

  const handleQuoteNavigate = useCallback((targetMessageId: string) => {
    if (!scrollToConversationMessage(targetMessageId)) return;
    setFlashingMessageId(targetMessageId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlashingMessageId(null);
      flashTimerRef.current = null;
    }, QUOTED_TARGET_FLASH_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Bot className="size-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-base font-semibold text-muted-foreground">No messages yet</p>
        <p className="mt-1 text-sm text-muted-foreground/70">History will appear here</p>
      </div>
    );
  }

  return (
    <div className="px-1">
      {showStickyDate && activeDateIso && stickyDateLabel ? (
        <ConversationMessageStickyDate dateIso={activeDateIso} label={stickyDateLabel} />
      ) : null}
      {(hasMoreOlderMessages || loadingOlderMessages) && (
        <div className="flex min-h-9 flex-col items-center justify-center gap-1 py-2">
          {loadingOlderMessages ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading earlier messages" />
          ) : null}
          {hasMoreOlderMessages && !loadingOlderMessages && onLoadOlderMessages ? (
            <button
              type="button"
              onClick={() => onLoadOlderMessages()}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Load earlier messages
            </button>
          ) : null}
        </div>
      )}
      {messages.map((m, i) => {
        const previousMessage = i > 0 ? messages[i - 1] : null;
        const showDateDivider =
          previousMessage === null ||
          !isSameConversationMessageDay(previousMessage.created_at, m.created_at);

        return (
          <div key={m.id}>
            {showDateDivider ? <ConversationMessageDateDivider dateIso={m.created_at} /> : null}
            <ConversationMessageItem
              message={m}
              previousMessage={previousMessage}
              nextMessage={i < messages.length - 1 ? messages[i + 1] : null}
              groupParticipantColorOrderByKey={groupParticipantColorOrderByKey}
              quotedParticipantDisplayLookup={quotedParticipantDisplayLookup}
              whatsappExternalIdLookup={whatsappExternalIdLookup}
              flashingMessageId={flashingMessageId}
              onQuoteNavigate={handleQuoteNavigate}
            />
          </div>
        );
      })}
    </div>
  );
}

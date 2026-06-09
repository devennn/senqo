import { Bot, User } from "lucide-react";
import { ConversationOutboundSendIndicator } from "@/pages/dashboard/components/conversation-outbound-send-indicator";
import {
  getGroupParticipantColorClassesByParticipantOrder,
  getGroupParticipantStableKey,
} from "@/lib/group-participant-color";
import { getMessageClusterSenderKey } from "@/lib/conversation-message-cluster";
import {
  getOperatorAiReasoning,
  shouldShowOperatorAiReasoningFooter,
} from "@/lib/conversation-operator-ai-reasoning";
import { asConversationThreadEventType } from "@/lib/conversation-thread-events";
import { MessageMedia } from "@/pages/dashboard/components/message-media";
import { ConversationOperatorAiReasoning } from "@/pages/dashboard/components/conversation-operator-ai-reasoning";
import { ConversationThreadEvent } from "@/pages/dashboard/components/conversation-thread-event";
import { formatConversationMessageTime } from "@/lib/format-conversation-message-time";
import { getQuotedPreview } from "@/lib/conversation-quoted-preview";
import { conversationMessageDomId } from "@/lib/conversation-quoted-scroll";
import { ConversationQuotedBlock } from "@/pages/dashboard/components/conversation-quoted-block";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/types/repositories";

function labelFromWhatsappId(chatId: string | null): string | null {
  const id = chatId?.split("@")[0]?.trim();
  return id || null;
}

function getSenderLabel(message: ConversationMessage): string | null {
  if (message.outgoing_sender_type === "ai_agent") return "AI";
  if (message.role !== "user") return "Human";
  const metadata = message.metadata as Record<string, unknown> | null;
  const isGroupChat = metadata?.isGroupChat === true;
  if (!isGroupChat) return null;
  return message.whatsapp_sender_name || labelFromWhatsappId(message.whatsapp_sender_chat_id) || "Group participant";
}

export function ConversationMessageItem({
  message,
  previousMessage,
  nextMessage,
  groupParticipantColorOrderByKey,
  quotedParticipantDisplayLookup,
  whatsappExternalIdLookup,
  flashingMessageId,
  onQuoteNavigate,
}: {
  message: ConversationMessage;
  previousMessage: ConversationMessage | null;
  nextMessage: ConversationMessage | null;
  groupParticipantColorOrderByKey: Map<string, number>;
  quotedParticipantDisplayLookup: Map<string, string>;
  whatsappExternalIdLookup: Map<string, string>;
  flashingMessageId: string | null;
  onQuoteNavigate: (targetMessageId: string) => void;
}) {
  const metadata =
    message.metadata && typeof message.metadata === "object"
      ? (message.metadata as Record<string, unknown>)
      : null;
  const threadEventType = asConversationThreadEventType(metadata?.thread_event);
  if (threadEventType) {
    const summaryText =
      threadEventType === "handoff_to_human" && typeof metadata?.handoff_tool_reason === "string"
        ? metadata.handoff_tool_reason.trim() || null
        : null;
    return (
      <ConversationThreadEvent
        eventType={threadEventType}
        summaryText={summaryText}
        reasoningText={getOperatorAiReasoning(message)}
      />
    );
  }

  const isUser = message.role === "user";
  const isAi = message.outgoing_sender_type === "ai_agent";
  const isHumanOutgoing = !isUser && !isAi;
  const senderKey = getMessageClusterSenderKey(message);
  const clusterHead =
    previousMessage === null || getMessageClusterSenderKey(previousMessage) !== senderKey;
  const tightWithNext =
    nextMessage !== null && getMessageClusterSenderKey(nextMessage) === senderKey;

  const quoted = getQuotedPreview(
    message,
    quotedParticipantDisplayLookup,
    whatsappExternalIdLookup,
  );
  const isFlashing = flashingMessageId === message.id;
  const senderLabel = getSenderLabel(message);
  const participantKey = getGroupParticipantStableKey(message);
  const participantOrder =
    participantKey !== null ? groupParticipantColorOrderByKey.get(participantKey) : undefined;
  const groupParticipantStyles =
    participantOrder !== undefined
      ? getGroupParticipantColorClassesByParticipantOrder(participantOrder)
      : null;
  const quoteClass = isAi
    ? "border-purple-500/70 bg-purple-500/5"
    : isHumanOutgoing
      ? "border-primary/80 bg-white/70"
      : "border-muted-foreground/30 bg-muted/30";
  const isAudioMessage = message.media?.mimeType?.startsWith("audio/") ?? false;
  const showContent = !isAudioMessage && message.content.trim().length > 0;
  const showSenderHeader = clusterHead && senderLabel;
  const operatorReasoningText = shouldShowOperatorAiReasoningFooter(message, nextMessage)
    ? getOperatorAiReasoning(message)
    : null;
  const outerMb = operatorReasoningText ? "mb-5" : tightWithNext ? "mb-1" : "mb-5";
  const messageTimeLabel = formatConversationMessageTime(message.created_at);

  return (
    <div id={conversationMessageDomId(message.id)} className={cn(outerMb)}>
      <div className={cn("flex items-end gap-3", !isUser && "flex-row-reverse")}>
        {clusterHead ? (
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              groupParticipantStyles?.avatarWrapClass,
              !groupParticipantStyles &&
                (isAi ? "bg-purple-500/10" : isHumanOutgoing ? "bg-primary/10" : "bg-background"),
            )}
          >
            {isAi ? (
              <Bot className="size-4 text-purple-700" />
            ) : (
              <User
                className={cn(
                  "size-4",
                  groupParticipantStyles?.avatarIconClass,
                  !groupParticipantStyles && (isHumanOutgoing ? "text-primary" : "text-muted-foreground"),
                )}
              />
            )}
          </div>
        ) : (
          <div className="size-8 shrink-0" aria-hidden />
        )}
        <div className={cn("min-w-0 flex-1", !isUser && "flex flex-col items-end")}>
          <div
            className={cn(
              "w-fit min-w-0 max-w-[calc(100%-2.75rem)] sm:max-w-[85%]",
              !isUser && "flex flex-row items-center justify-end gap-1.5",
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed text-foreground shadow-sm ring-1 ring-black/5",
                isUser ? "rounded-tl-sm" : "rounded-tr-sm",
                groupParticipantStyles?.bubbleAccentClass,
                isAi ? "bg-purple-500/10" : isHumanOutgoing ? "bg-[#d9fdd3]" : "bg-white",
                isFlashing && "conversation-message-target-flash",
              )}
            >
              {showSenderHeader ? (
                <p
                  className={cn(
                    "mb-1 text-[0.68rem] font-semibold uppercase tracking-wide",
                    groupParticipantStyles?.labelClass,
                    !groupParticipantStyles &&
                      (isAi ? "text-purple-700" : isHumanOutgoing ? "text-primary" : "text-muted-foreground"),
                  )}
                >
                  {senderLabel}
                </p>
              ) : null}
              {quoted ? (
                <ConversationQuotedBlock
                  preview={quoted}
                  className={`mb-2 ${quoteClass}`}
                  onNavigate={
                    quoted.targetMessageId
                      ? () => onQuoteNavigate(quoted.targetMessageId!)
                      : undefined
                  }
                />
              ) : null}
              {message.media && <MessageMedia media={message.media} />}
              {showContent ? (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              ) : null}
              {messageTimeLabel ? (
                <div className="mt-1 flex justify-end">
                  <time
                    className="text-[0.68rem] leading-none text-muted-foreground/80"
                    dateTime={message.created_at}
                  >
                    {messageTimeLabel}
                  </time>
                </div>
              ) : null}
            </div>
            {!isUser ? <ConversationOutboundSendIndicator message={message} /> : null}
          </div>
        </div>
      </div>
      {operatorReasoningText ? (
        <ConversationOperatorAiReasoning text={operatorReasoningText} alignEnd={!isUser} />
      ) : null}
    </div>
  );
}

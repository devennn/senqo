import { useEffect, useRef } from "react";
import { ConversationContactHeader } from "@/pages/dashboard/components/conversation-contact-header";
import { ConversationMessageList } from "@/pages/dashboard/components/conversation-message-list";
import { MessageComposer } from "@/pages/dashboard/components/message-composer";
import { cn } from "@/lib/utils";
import type {
  ConversationHeaderData,
  ConversationMessage,
} from "@/types/repositories";

export function ConversationChat({
  className,
  messages,
  conversation,
  fallbackTitle,
  emptyHint,
}: {
  className?: string;
  messages: ConversationMessage[];
  conversation: ConversationHeaderData | null;
  fallbackTitle?: string;
  emptyHint?: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const showThread = conversation !== null || messages.length > 0;

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
  }, [messages]);

  if (!showThread) {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
        <div className="bg-chat-thread flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="card-surface max-w-sm p-8">
            <img
              src="/icon_transparent_bg.png"
              alt=""
              className="mx-auto size-14 object-contain"
            />
            <p className="mt-5 text-base font-semibold text-foreground">
              No conversation selected
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {emptyHint ??
                "Choose a chat from the list to view details and message."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <ConversationContactHeader
        conversation={conversation}
        fallbackTitle={fallbackTitle}
      />
      <div
        ref={scrollContainerRef}
        className="bg-chat-thread min-h-0 flex-1 overflow-y-auto px-6 py-4"
      >
        <h2 className="sr-only">Conversation history</h2>
        <ConversationMessageList messages={messages} scrollContainerRef={scrollContainerRef} />
      </div>
      <MessageComposer
        key={conversation?.id ?? "empty"}
        handlingMode={conversation?.handlingMode}
        connectionAiEnabled={conversation?.connectionAiEnabled}
        canSendManualWhatsapp={conversation?.canSendManualWhatsapp ?? true}
        whatsappConnection={conversation?.whatsappConnection}
      />
    </div>
  );
}

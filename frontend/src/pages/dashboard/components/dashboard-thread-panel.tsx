import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ConversationMessageList } from "@/pages/dashboard/components/conversation-message-list";
import { MessageComposer } from "@/pages/dashboard/components/message-composer";
import { ConversationContactHeader } from "@/pages/dashboard/components/conversation-contact-header";
import type {
  ConversationAttachmentInput,
  ConversationHandlingMode,
  ConversationHeaderData,
  ConversationLabelRecord,
  ConversationMessage,
} from "@/types/repositories";
import type { RefObject } from "react";

export function DashboardThreadPanel({
  activeConversation,
  labelCatalog = [],
  messages,
  scrollRef,
  hasMoreOlderMessages,
  loadingOlderMessages,
  onLoadOlderMessages,
  handlingModeSaving,
  isOwner = false,
  onRefresh,
  onDelete,
  onHandlingModeChange,
  onSendMessage,
  onSendAttachment,
}: {
  activeConversation: ConversationHeaderData | null;
  labelCatalog?: ConversationLabelRecord[];
  messages: ConversationMessage[];
  scrollRef: RefObject<HTMLDivElement | null>;
  hasMoreOlderMessages: boolean;
  loadingOlderMessages: boolean;
  onLoadOlderMessages: () => void;
  handlingModeSaving: boolean;
  isOwner?: boolean;
  onRefresh: () => Promise<void>;
  onDelete: () => void;
  onHandlingModeChange: (mode: ConversationHandlingMode) => Promise<void>;
  onSendMessage: (message: string) => Promise<void>;
  onSendAttachment: (input: ConversationAttachmentInput) => Promise<void>;
}) {
  if (!activeConversation) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/60 bg-card/90 px-4 py-2 md:hidden">
        <Link
          to=".."
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "-ml-2",
          })}
        >
          <ArrowLeft className="size-4" />
          Back to chats
        </Link>
      </div>
      <ConversationContactHeader
        conversation={activeConversation}
        labelCatalog={labelCatalog}
        onUserLabelsSaved={() => void onRefresh()}
        onDelete={onDelete}
        isOwner={isOwner}
      />
      <div
        ref={scrollRef}
        className="bg-chat-thread min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
      >
        <ConversationMessageList
          messages={messages}
          scrollContainerRef={scrollRef}
          hasMoreOlderMessages={hasMoreOlderMessages}
          loadingOlderMessages={loadingOlderMessages}
          onLoadOlderMessages={onLoadOlderMessages}
        />
      </div>
      <MessageComposer
        key={activeConversation.id}
        handlingMode={activeConversation.handlingMode}
        connectionAiEnabled={activeConversation.connectionAiEnabled}
        canSendManualWhatsapp={activeConversation.canSendManualWhatsapp}
        whatsappConnection={activeConversation.whatsappConnection}
        handlingModeSaving={handlingModeSaving}
        onHandlingModeChange={onHandlingModeChange}
        onSend={onSendMessage}
        onSendAttachment={onSendAttachment}
      />
    </div>
  );
}
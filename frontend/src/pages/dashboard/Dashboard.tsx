import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { parseHumanOnlySearchParam } from "@/lib/build-conversations-query";
import { AppFrame } from "@/components/layout/app-frame";
import { PageLoader } from "@/components/ui/spinner";
import { DashboardThreadPanel } from "@/pages/dashboard/components/dashboard-thread-panel";
import { useDashboardThread } from "@/hooks/useDashboardThread";
import { useIsWorkspaceOwner } from "@/hooks/useIsWorkspaceOwner";
import { useWorkspace } from "@/context/workspace";
import type {
  ConversationAttachmentInput,
  ConversationHandlingMode,
  ConversationMessage,
  SendConversationMessageResponse,
} from "@/types/repositories";

function buildOptimisticHumanOutgoingMessage(content: string): ConversationMessage {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    role: "assistant",
    content,
    created_at: new Date().toISOString(),
    metadata: null,
    outgoing_sender_type: "human",
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
    clientSendState: "sending",
  };
}

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { wsPath } = useWorkspace();
  const conversationId = searchParams.get("conversationId");
  const searchQuery = searchParams.get("q") ?? "";
  const labelId = searchParams.get("labelId") ?? "";
  const humanOnly = parseHumanOnlySearchParam(searchParams.get("humanOnly"));
  const connectionId = searchParams.get("connectionId") ?? "";
  const [handlingModeSaving, setHandlingModeSaving] = useState(false);

  const {
    conversations,
    labelCatalog,
    messages,
    loadingConversations,
    loadingConversationDetail,
    loadingOlderMessages,
    hasMoreOlderMessages,
    loadOlderMessages,
    activeConversation,
    setActiveConversation,
    setConversations,
    setMessages,
    scrollRef,
    refreshThreadAndList,
    newConversationIds,
  } = useDashboardThread(conversationId, searchQuery, labelId, humanOnly, connectionId);
  const { isOwner } = useIsWorkspaceOwner();

  useEffect(() => {
    if (loadingConversations || conversationId || conversations.length === 0)
      return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversationId", conversations[0].id);
    navigate(`${wsPath("/dashboard")}?${params.toString()}`, { replace: true });
  }, [
    conversationId,
    conversations,
    loadingConversations,
    navigate,
    searchParams,
  ]);

  async function handleHandlingModeChange(mode: ConversationHandlingMode) {
    if (
      !conversationId ||
      !activeConversation ||
      activeConversation.handlingMode === mode
    )
      return;
    const previousMode = activeConversation.handlingMode;
    setHandlingModeSaving(true);
    setActiveConversation((current) =>
      current?.id === conversationId
        ? { ...current, handlingMode: mode }
        : current,
    );
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, handlingMode: mode }
          : conversation,
      ),
    );
    try {
      await api.patch(
        `/api/user/conversations/${conversationId}/handling-mode`,
        { handlingMode: mode },
      );
      await refreshThreadAndList();
    } catch (error) {
      setActiveConversation((current) =>
        current?.id === conversationId
          ? { ...current, handlingMode: previousMode }
          : current,
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, handlingMode: previousMode }
            : conversation,
        ),
      );
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update handling mode.",
      );
    } finally {
      setHandlingModeSaving(false);
    }
  }

  async function handleDeleteConversation() {
    if (!conversationId) return;
    await api.post(`/api/user/conversations/${conversationId}/delete`);
    setConversations((current) =>
      current.filter((conversation) => conversation.id !== conversationId),
    );
    setActiveConversation(null);
    setMessages([]);
    navigate(buildBackToChatsPath(), { replace: true });
  }

  async function handleSendMessage(message: string) {
    if (!conversationId) return;
    const optimistic = buildOptimisticHumanOutgoingMessage(message);
    setMessages((prev) => [...prev, optimistic]);
    try {
      await api.post<SendConversationMessageResponse>(
        `/api/user/conversations/${conversationId}/messages`,
        { message },
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, clientSendState: undefined } : m,
        ),
      );
      await refreshThreadAndList();
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, clientSendState: "failed" as const } : m,
        ),
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to send message.",
      );
      throw error;
    }
  }

  async function handleSendAttachment({
    file,
    kind,
    caption,
  }: ConversationAttachmentInput) {
    if (!conversationId) return;
    const summary =
      kind === "audio"
        ? "Voice note"
        : kind === "image"
          ? caption?.trim() || file.name || "Image"
          : caption?.trim() || file.name || "File";
    const optimistic = buildOptimisticHumanOutgoingMessage(summary);
    setMessages((prev) => [...prev, optimistic]);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("mediaKind", kind);
      if (kind !== "audio" && caption?.trim()) {
        formData.set("caption", caption.trim());
      }
      await api.postForm<SendConversationMessageResponse>(
        `/api/user/conversations/${conversationId}/messages`,
        formData,
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, clientSendState: undefined } : m,
        ),
      );
      await refreshThreadAndList();
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, clientSendState: "failed" as const } : m,
        ),
      );
      toast.error(
        error instanceof Error ? error.message : "Failed to send attachment.",
      );
      throw error;
    }
  }

  const showLoading = loadingConversations || loadingConversationDetail;
  const showThread = !!conversationId && !!activeConversation;
  const mobilePanel = showLoading || showThread ? "main" : "side";

  function buildBackToChatsPath(): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("conversationId");
    const qs = params.toString();
    const base = wsPath("/dashboard");
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <AppFrame
      conversations={conversations}
      messages={messages}
      selectedConversation={activeConversation}
      conversationLabelCatalog={labelCatalog}
      loadingConversations={loadingConversations}
      newConversationIds={newConversationIds}
      mobilePanel={mobilePanel}
      mainPanel={
        showLoading ? (
          <PageLoader label="Loading conversations" />
        ) :         showThread ? (
          <DashboardThreadPanel
            activeConversation={activeConversation}
            labelCatalog={labelCatalog}
            messages={messages}
            scrollRef={scrollRef}
            hasMoreOlderMessages={hasMoreOlderMessages}
            loadingOlderMessages={loadingOlderMessages}
            onLoadOlderMessages={loadOlderMessages as () => void}
            handlingModeSaving={handlingModeSaving}
            isOwner={isOwner}
            onRefresh={refreshThreadAndList}
            onDelete={handleDeleteConversation}
            onHandlingModeChange={handleHandlingModeChange}
            onSendMessage={handleSendMessage}
            onSendAttachment={handleSendAttachment}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
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
                  Choose a chat from the list to view details and message.
                </p>
              </div>
            </div>
          </div>
        )
      }
    />
  );
}

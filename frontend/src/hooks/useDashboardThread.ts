import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/workspace";
import { api } from "@/lib/api";
import { buildConversationsQuery } from "@/lib/build-conversations-query";
import { mergeConversationMessagesOnRefresh } from "@/lib/conversation-message-cursor";
import { useRealtime, type RealtimeEvent } from "@/hooks/useRealtime";
import {
  CONVERSATION_THREAD_MESSAGES_PAGE_SIZE,
  type ConversationHeaderData,
  type ConversationLabelRecord,
  type ConversationMessage,
  type ConversationSummary,
  type ConversationThreadDetailResponse,
  type ConversationThreadMessagesPage,
} from "@/types/repositories";

// Safety-net poll interval — covers dropped SSE connections and edge cases.
// Reduced from 3s now that SSE pushes changes instantly.
const POLL_INTERVAL_MS = 15_000;

export function useDashboardThread(
  conversationId: string | null,
  searchQuery: string,
  labelId: string,
  humanOnly: boolean,
  connectionId: string,
) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [labelCatalog, setLabelCatalog] = useState<ConversationLabelRecord[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingConversationDetail, setLoadingConversationDetail] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [activeConversation, setActiveConversation] = useState<ConversationHeaderData | null>(null);
  const { workspaceId } = useWorkspace();
  // IDs of conversations that just arrived via realtime — used for the brief
  // highlight animation in the list. Auto-cleared after 2.5s.
  const [newConversationIds, setNewConversationIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const hasMoreOlderMessagesRef = useRef(false);
  const loadingOlderMessagesRef = useRef(false);
  const loadOlderMessagesRef = useRef<() => Promise<void>>(async () => {});
  const scrollRestoreRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);
  const userNearBottomRef = useRef(true);
  const oldestHistoryFullyLoadedRef = useRef(false);

  const conversationsQs = buildConversationsQuery(searchQuery, labelId, humanOnly, connectionId);

  messagesRef.current = messages;
  hasMoreOlderMessagesRef.current = hasMoreOlderMessages;
  loadingOlderMessagesRef.current = loadingOlderMessages;

  useEffect(() => {
    void api.get<{ labels: ConversationLabelRecord[] }>("/api/user/conversation-labels").then((res) => {
      setLabelCatalog(res.labels);
    });
  }, []);

  // Stable ref to the current conversations so the realtime handler can diff.
  const conversationsRef = useRef<ConversationSummary[]>([]);
  conversationsRef.current = conversations;

  const reloadConversations = useCallback(() => {
    return api
      .get<{ conversations: ConversationSummary[] }>(`/api/user/conversations${conversationsQs}`)
      .then((res) => {
        const next = res.conversations;
        // Detect IDs that weren't in the previous list — mark them for highlight.
        const prevIds = new Set(conversationsRef.current.map((c) => c.id));
        const arrived = next.filter((c) => !prevIds.has(c.id)).map((c) => c.id);
        if (arrived.length > 0) {
          setNewConversationIds((prev) => {
            const s = new Set(prev);
            arrived.forEach((id) => s.add(id));
            return s;
          });
          // Auto-clear highlights after 2.5s.
          setTimeout(() => {
            setNewConversationIds((prev) => {
              const s = new Set(prev);
              arrived.forEach((id) => s.delete(id));
              return s;
            });
          }, 2500);
        }
        setConversations(next);
      });
  }, [conversationsQs]);

  useEffect(() => {
    setLoadingConversations(true);
    reloadConversations().finally(() => setLoadingConversations(false));
  }, [reloadConversations]);

  useEffect(() => {
    if (!conversationId) {
      setLoadingConversationDetail(false);
      setMessages([]);
      setActiveConversation(null);
      setHasMoreOlderMessages(false);
      oldestHistoryFullyLoadedRef.current = false;
      userNearBottomRef.current = true;
      return;
    }
    let mounted = true;
    setLoadingConversationDetail(true);
    setMessages([]);
    setActiveConversation(null);
    setHasMoreOlderMessages(false);
    oldestHistoryFullyLoadedRef.current = false;
    userNearBottomRef.current = true;
    const qs = new URLSearchParams({
      messagesLimit: String(CONVERSATION_THREAD_MESSAGES_PAGE_SIZE),
    });
    api
      .get<ConversationThreadDetailResponse>(
        `/api/user/conversations/${conversationId}?${qs.toString()}`,
      )
      .then((res) => {
        if (!mounted) return;
        setActiveConversation(res.conversation);
        setMessages(res.messages);
        setHasMoreOlderMessages(res.hasMoreOlderMessages);
        oldestHistoryFullyLoadedRef.current = !res.hasMoreOlderMessages;
      })
      .finally(() => {
        if (mounted) setLoadingConversationDetail(false);
      });
    return () => {
      mounted = false;
    };
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !conversationId) return;
    const onScroll = () => {
      const threshold = 80;
      userNearBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      const scrollableEnough = el.scrollHeight > el.clientHeight + 32;
      if (
        scrollableEnough &&
        el.scrollTop < 120 &&
        hasMoreOlderMessagesRef.current &&
        !loadingOlderMessagesRef.current
      ) {
        void loadOlderMessagesRef.current();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [conversationId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !conversationId) return;
    const restore = scrollRestoreRef.current;
    if (restore) {
      scrollRestoreRef.current = null;
      const delta = el.scrollHeight - restore.prevScrollHeight;
      el.scrollTop = restore.prevScrollTop + delta;
      return;
    }
    if (userNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, conversationId]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loadingOlderMessages || !hasMoreOlderMessages) return;
    const first = messages[0];
    if (!first) return;
    const el = scrollRef.current;
    if (el) {
      scrollRestoreRef.current = { prevScrollHeight: el.scrollHeight, prevScrollTop: el.scrollTop };
    }
    loadingOlderMessagesRef.current = true;
    setLoadingOlderMessages(true);
    try {
      const qs = new URLSearchParams({
        beforeCreatedAt: first.created_at,
        beforeId: first.id,
        limit: String(CONVERSATION_THREAD_MESSAGES_PAGE_SIZE),
      });
      const page = await api.get<ConversationThreadMessagesPage>(
        `/api/user/conversations/${conversationId}/messages?${qs.toString()}`,
      );
      setMessages((prev) => [...page.messages, ...prev]);
      setHasMoreOlderMessages(page.hasMoreOlderMessages);
      if (!page.hasMoreOlderMessages) {
        oldestHistoryFullyLoadedRef.current = true;
      }
    } finally {
      loadingOlderMessagesRef.current = false;
      setLoadingOlderMessages(false);
    }
  }, [conversationId, hasMoreOlderMessages, loadingOlderMessages, messages]);

  loadOlderMessagesRef.current = loadOlderMessages;

  const refreshThreadAndList = useCallback(async () => {
    const qs = buildConversationsQuery(searchQuery, labelId, humanOnly, connectionId);
    const listPromise = api
      .get<{ conversations: ConversationSummary[] }>(`/api/user/conversations${qs}`)
      .then((res) => setConversations(res.conversations));
    const catalogPromise = api
      .get<{ labels: ConversationLabelRecord[] }>("/api/user/conversation-labels")
      .then((res) => setLabelCatalog(res.labels));
    const tasks: Promise<unknown>[] = [listPromise, catalogPromise];
    if (conversationId) {
      const detailQs = new URLSearchParams({
        messagesLimit: String(CONVERSATION_THREAD_MESSAGES_PAGE_SIZE),
      });
      tasks.push(
        api
          .get<ConversationThreadDetailResponse>(
            `/api/user/conversations/${conversationId}?${detailQs.toString()}`,
          )
          .then((res) => {
            setActiveConversation(res.conversation);
            const prev = messagesRef.current;
            const { messages: next, droppedOlderPrefetch } = mergeConversationMessagesOnRefresh(
              prev,
              res.messages,
            );
            if (droppedOlderPrefetch) {
              oldestHistoryFullyLoadedRef.current = !res.hasMoreOlderMessages;
              setHasMoreOlderMessages(res.hasMoreOlderMessages);
            } else {
              const nextHasMore = res.hasMoreOlderMessages || !oldestHistoryFullyLoadedRef.current;
              setHasMoreOlderMessages(nextHasMore);
              if (res.hasMoreOlderMessages) {
                oldestHistoryFullyLoadedRef.current = false;
              }
            }
            setMessages(next);
          }),
      );
    }
    await Promise.all(tasks);
  }, [connectionId, conversationId, humanOnly, labelId, searchQuery]);

  // Stable ref so the SSE handler can read the current conversationId without
  // re-subscribing every time it changes.
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Realtime handler: coalesces bursts within 300ms, then reloads.
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventRef = useRef<RealtimeEvent | null>(null);

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    pendingEventRef.current = event;
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      const latest = pendingEventRef.current;
      pendingEventRef.current = null;
      // Always reload the list so the latest message preview and ordering update.
      void reloadConversations();
      // If the event is for the currently-open conversation, also refresh messages.
      if (latest && conversationIdRef.current && latest.conversationId === conversationIdRef.current) {
        const detailQs = new URLSearchParams({
          messagesLimit: String(CONVERSATION_THREAD_MESSAGES_PAGE_SIZE),
        });
        void api
          .get<ConversationThreadDetailResponse>(
            `/api/user/conversations/${conversationIdRef.current}?${detailQs.toString()}`,
          )
          .then((res) => {
            setActiveConversation(res.conversation);
            const prev = messagesRef.current;
            const { messages: next, droppedOlderPrefetch } = mergeConversationMessagesOnRefresh(
              prev,
              res.messages,
            );
            if (droppedOlderPrefetch) {
              oldestHistoryFullyLoadedRef.current = !res.hasMoreOlderMessages;
              setHasMoreOlderMessages(res.hasMoreOlderMessages);
            } else {
              const nextHasMore = res.hasMoreOlderMessages || !oldestHistoryFullyLoadedRef.current;
              setHasMoreOlderMessages(nextHasMore);
              if (res.hasMoreOlderMessages) oldestHistoryFullyLoadedRef.current = false;
            }
            setMessages(next);
          });
      }
    }, 300);
  }, [reloadConversations]);

  useRealtime(workspaceId, handleRealtimeEvent);

  // Safety-net poll: covers dropped SSE or edge cases. Runs only while a
  // conversation is open (same condition as before, just less frequent).
  useEffect(() => {
    if (!workspaceId || !conversationId) return;
    const interval = setInterval(() => {
      void refreshThreadAndList();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [workspaceId, conversationId, refreshThreadAndList]);

  return {
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
  };
}
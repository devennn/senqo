import type { ConversationMessage } from "@/types/repositories";

const OPTIMISTIC_ID_PREFIX = "optimistic-";

function isOptimisticClientMessage(m: ConversationMessage): boolean {
  return m.id.startsWith(OPTIMISTIC_ID_PREFIX);
}

/** Drop optimistic rows once a matching server message exists (same bubble + body, plausible time). */
export function stripOptimisticDuplicateOfAnyServerMessage(
  messages: ConversationMessage[],
): ConversationMessage[] {
  const serverMsgs = messages.filter((m) => !isOptimisticClientMessage(m));
  return messages.filter((m) => {
    if (!isOptimisticClientMessage(m)) return true;
    if (m.clientSendState === "failed") return true;
    return !serverMsgs.some((s) => optimisticMatchesServerRow(m, s));
  });
}

function optimisticMatchesServerRow(
  optimistic: ConversationMessage,
  server: ConversationMessage,
): boolean {
  if (optimistic.role !== server.role) return false;
  if (optimistic.outgoing_sender_type !== server.outgoing_sender_type) return false;
  if (optimistic.content.trim() !== server.content.trim()) return false;
  const t0 = new Date(optimistic.created_at).getTime();
  const t1 = new Date(server.created_at).getTime();
  return t1 >= t0 - 5000 && t1 <= t0 + 180_000;
}

export function isConversationMessageStrictlyBefore(
  a: ConversationMessage,
  b: ConversationMessage,
): boolean {
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at;
  }
  return a.id < b.id;
}

/** Keeps messages strictly older than the server's latest page, then appends that page (chronological). */
export function mergeConversationMessagesLatestPage(
  previous: ConversationMessage[],
  latestFromServer: ConversationMessage[],
): ConversationMessage[] {
  if (latestFromServer.length === 0) return previous;
  const oldestLatest = latestFromServer[0];
  const serverIds = new Set(latestFromServer.map((m) => m.id));
  const olderOnly = previous.filter(
    (m) => !serverIds.has(m.id) && isConversationMessageStrictlyBefore(m, oldestLatest),
  );
  const pendingClient = previous.filter(
    (m) =>
      isOptimisticClientMessage(m) &&
      !serverIds.has(m.id) &&
      !isConversationMessageStrictlyBefore(m, oldestLatest),
  );
  return stripOptimisticDuplicateOfAnyServerMessage([
    ...olderOnly,
    ...latestFromServer,
    ...pendingClient,
  ]);
}

/**
 * Merges a freshly fetched latest page into existing history. If the previous
 * window does not touch the new page (hole in the timeline), returns only the
 * server page so we never render impossible gaps.
 */
export function mergeConversationMessagesOnRefresh(
  previous: ConversationMessage[],
  latestFromServer: ConversationMessage[],
): { messages: ConversationMessage[]; droppedOlderPrefetch: boolean } {
  if (latestFromServer.length === 0) {
    return { messages: previous, droppedOlderPrefetch: false };
  }
  if (previous.length === 0) {
    return { messages: latestFromServer, droppedOlderPrefetch: false };
  }
  const prevLast = previous[previous.length - 1];
  const resFirst = latestFromServer[0];
  if (isConversationMessageStrictlyBefore(prevLast, resFirst)) {
    const pendingClient = previous.filter((m) => isOptimisticClientMessage(m));
    return {
      messages: stripOptimisticDuplicateOfAnyServerMessage([
        ...latestFromServer,
        ...pendingClient,
      ]),
      droppedOlderPrefetch: true,
    };
  }
  return {
    messages: mergeConversationMessagesLatestPage(previous, latestFromServer),
    droppedOlderPrefetch: false,
  };
}

import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useRef, useTransition } from "react";
import { parseHumanOnlySearchParam } from "@/lib/build-conversations-query";
import { ConversationListFiltersPanel } from "@/components/layout/conversation-list-filters-panel";
import { ConversationListEmptyState } from "@/components/layout/conversation-list-empty-state";
import { ConversationListRow } from "@/components/layout/conversation-list-row";
import { ConversationListLoadMoreRow } from "@/components/layout/conversation-list-load-more";
import { ConversationListSearchBox } from "@/components/layout/conversation-list-search-box";
import { useWhatsappConnectionsForInboxFilters } from "@/hooks/useWhatsappConnectionsForInboxFilters";
import type { ConversationLabelRecord, ConversationSummary } from "@/types/repositories";

/** Distance from the rail bottom that triggers loading the next page. */
const LOAD_MORE_SCROLL_THRESHOLD_PX = 240;

export function ConversationList({
  conversations,
  labelCatalog,
  loading,
  newConversationIds,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  conversations: ConversationSummary[];
  labelCatalog: ConversationLabelRecord[];
  loading?: boolean;
  newConversationIds?: Set<string>;
  /** Total conversations for the current filters (from the server). */
  total?: number;
  /** True when more pages exist on the server. */
  hasMore?: boolean;
  /** True while the next page is in flight. */
  loadingMore?: boolean;
  /** Loads the next rail page when the user scrolls near the bottom. */
  onLoadMore?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [searchParams] = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const currentLabelId = searchParams.get("labelId") ?? "";
  const humanOnlyFilter = parseHumanOnlySearchParam(searchParams.get("humanOnly"));
  const currentConnectionId = searchParams.get("connectionId") ?? "";
  const [, startTransition] = useTransition();
  const { connections: whatsappConnections } = useWhatsappConnectionsForInboxFilters();
  const railScrollRef = useRef<HTMLDivElement>(null);
  const paramId = searchParams.get("conversationId");
  const activeId = paramId ?? conversations[0]?.id ?? null;

  function buildRowLink(conversationId: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversationId", conversationId);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : `${pathname}`;
  }

  function setLabelFilter(nextLabelId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextLabelId) params.set("labelId", nextLabelId);
    else params.delete("labelId");
    params.delete("conversationId");
    const qs = params.toString();
    startTransition(() => navigate(qs ? `${pathname}?${qs}` : pathname, { replace: true }));
  }

  function setHumanOnlyFilter(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("humanOnly", "1");
    else params.delete("humanOnly");
    params.delete("conversationId");
    const qs = params.toString();
    startTransition(() => navigate(qs ? `${pathname}?${qs}` : pathname, { replace: true }));
  }

  function setConnectionFilter(nextConnectionId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextConnectionId) params.set("connectionId", nextConnectionId);
    else params.delete("connectionId");
    params.delete("conversationId");
    const qs = params.toString();
    startTransition(() => navigate(qs ? `${pathname}?${qs}` : pathname, { replace: true }));
  }

  function handleRailScroll() {
    const el = railScrollRef.current;
    if (!el || !hasMore || loadingMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_SCROLL_THRESHOLD_PX) {
      onLoadMore?.();
    }
  }

  return (
    <section className="flex h-full w-full shrink-0 flex-col rounded-2xl border border-border/70 bg-card/95 shadow-soft backdrop-blur md:w-[26rem]">
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
        <h2 className="text-lg font-bold tracking-tight">Chats</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {total ?? conversations.length}
        </span>
      </div>

      <ConversationListFiltersPanel
        labelCatalog={labelCatalog}
        currentLabelId={currentLabelId}
        onLabelFilter={setLabelFilter}
        humanOnlyFilter={humanOnlyFilter}
        onHumanOnlyFilter={setHumanOnlyFilter}
        whatsappConnections={whatsappConnections}
        currentConnectionId={currentConnectionId}
        onConnectionFilter={setConnectionFilter}
      />

      <ConversationListSearchBox currentQuery={currentQuery} />

      <div
        ref={railScrollRef}
        onScroll={handleRailScroll}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
      >
        {loading ? (
          <div className="m-2 rounded-2xl border border-border bg-muted/30 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">Loading conversations</p>
            <p className="mt-1 text-sm text-muted-foreground">Fetching your latest chats...</p>
          </div>
        ) : null}
        {!loading && conversations.map((c) => (
          <ConversationListRow
            key={c.id}
            conversation={c}
            to={buildRowLink(c.id)}
            isActive={activeId === c.id}
            isNew={newConversationIds?.has(c.id) ?? false}
          />
        ))}
        {!loading ? <ConversationListLoadMoreRow loading={loadingMore} /> : null}
        {!loading && conversations.length === 0 ? (
          <ConversationListEmptyState
            humanOnlyFilter={humanOnlyFilter}
            connectionFilter={currentConnectionId.trim().length > 0}
          />
        ) : null}
      </div>
    </section>
  );
}

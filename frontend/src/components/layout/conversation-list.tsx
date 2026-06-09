import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { parseHumanOnlySearchParam } from "@/lib/build-conversations-query";
import { ConversationListFiltersPanel } from "@/components/layout/conversation-list-filters-panel";
import { cn } from "@/lib/utils";
import { ConversationListEmptyState } from "@/components/layout/conversation-list-empty-state";
import { ConversationListRow } from "@/components/layout/conversation-list-row";
import { useWhatsappConnectionsForInboxFilters } from "@/hooks/useWhatsappConnectionsForInboxFilters";
import type { ConversationLabelRecord, ConversationSummary } from "@/types/repositories";

const SEARCH_DEBOUNCE_MS = 700;

export function ConversationList({
  conversations,
  labelCatalog,
  loading,
  newConversationIds,
}: {
  conversations: ConversationSummary[];
  labelCatalog: ConversationLabelRecord[];
  loading?: boolean;
  newConversationIds?: Set<string>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [searchParams] = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const currentLabelId = searchParams.get("labelId") ?? "";
  const humanOnlyFilter = parseHumanOnlySearchParam(searchParams.get("humanOnly"));
  const currentConnectionId = searchParams.get("connectionId") ?? "";
  const [isPending, startTransition] = useTransition();
  const { connections: whatsappConnections } = useWhatsappConnectionsForInboxFilters();
  const [search, setSearch] = useState(currentQuery);
  const paramId = searchParams.get("conversationId");
  const activeId = paramId ?? conversations[0]?.id ?? null;

  useEffect(() => {
    setSearch(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const next = search.trim();
      if (next === currentQuery) return;
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("conversationId");
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      startTransition(() => navigate(nextUrl, { replace: true }));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [currentQuery, pathname, navigate, search, searchParams, startTransition]);

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

  return (
    <section className="flex h-full w-full shrink-0 flex-col rounded-2xl border border-border/70 bg-card/95 shadow-soft backdrop-blur md:w-[26rem]">
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
        <h2 className="text-lg font-bold tracking-tight">Chats</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {conversations.length}
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

      <div className="shrink-0 border-b border-border/40 bg-muted/20 px-3 py-2">
        <label
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground",
            isPending && "opacity-70"
          )}
        >
          <Search className="size-4 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, message"
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground/80"
            aria-label="Search conversations"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
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

import { useEffect, useState, useTransition } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 700;

/** Debounced inbox search input that syncs the `q` URL param. */
export function ConversationListSearchBox({ currentQuery }: { currentQuery: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [searchParams] = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentQuery);

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

  return (
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
  );
}

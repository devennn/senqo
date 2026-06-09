export function ConversationListEmptyState({
  humanOnlyFilter,
  connectionFilter,
}: {
  humanOnlyFilter: boolean;
  connectionFilter?: boolean;
}) {
  if (connectionFilter && humanOnlyFilter) {
    return (
      <div className="m-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-foreground">No chats match these filters</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try clearing the WhatsApp line filter, turning off human-handling-only, or loosening search.
        </p>
      </div>
    );
  }
  if (connectionFilter) {
    return (
      <div className="m-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-foreground">No chats for this WhatsApp line</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose &quot;All lines&quot; in filters to see chats from other connections.
        </p>
      </div>
    );
  }
  if (humanOnlyFilter) {
    return (
      <div className="m-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-foreground">No chats in human handling</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn off the filter to see all chats, or switch a chat to human handling from the thread.
        </p>
      </div>
    );
  }
  return (
    <div className="m-2 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">No conversations yet</p>
      <p className="mt-1 text-sm text-muted-foreground">New chats will show up here as they arrive.</p>
    </div>
  );
}

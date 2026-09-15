/** Inline row shown at the bottom of the chat rail while the next page loads. */
export function ConversationListLoadMoreRow({ loading }: { loading?: boolean }) {
  if (!loading) return null;
  return (
    <div className="m-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-center text-xs font-medium text-muted-foreground">
      Loading older chats…
    </div>
  );
}

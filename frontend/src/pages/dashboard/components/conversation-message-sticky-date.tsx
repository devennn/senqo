export function ConversationMessageStickyDate({
  dateIso,
  label,
}: {
  dateIso: string;
  label: string;
}) {
  return (
    <div className="pointer-events-none sticky top-0 z-20 -mx-1 flex justify-center pt-1 pb-2">
      <span className="rounded-full border border-border/50 bg-card/95 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
        <time dateTime={dateIso}>{label}</time>
      </span>
    </div>
  );
}

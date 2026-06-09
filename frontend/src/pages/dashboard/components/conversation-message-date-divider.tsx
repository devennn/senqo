import { formatConversationMessageDateGroup } from "@/lib/format-conversation-message-time";

export function ConversationMessageDateDivider({ dateIso }: { dateIso: string }) {
  const label = formatConversationMessageDateGroup(dateIso);
  if (!label) return null;

  return (
    <div className="my-4 flex justify-center" data-conversation-date-marker={dateIso}>
      <span className="rounded-full bg-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
        <time dateTime={dateIso}>{label}</time>
      </span>
    </div>
  );
}

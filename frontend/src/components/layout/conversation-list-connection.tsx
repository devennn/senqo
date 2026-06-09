import { Phone } from "lucide-react";

const CHIP_PHONE_MAX_CHARS = 14;

function ellipsize(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  if (maxChars <= 1) return "…";
  return `${t.slice(0, maxChars - 1)}…`;
}

/** Compact chip before the time: phone icon + number only (name on hover). */
export function ConversationListConnectionLine({
  connection,
}: {
  connection: { displayName: string; phoneNumber: string | null };
}) {
  const raw = connection.phoneNumber?.trim() ?? "";
  const hasPhone = raw.length > 0;
  const title = hasPhone
    ? `${connection.displayName} · ${raw}`
    : connection.displayName;
  const shown = hasPhone ? ellipsize(raw, CHIP_PHONE_MAX_CHARS) : "—";
  return (
    <span
      className="inline-flex max-w-[min(7.5rem,30vw)] min-w-0 shrink-0 items-center gap-2 rounded-md bg-muted/60 px-1.5 py-0.5 text-[0.6875rem] leading-none text-muted-foreground shadow-sm ring-1 ring-border/40"
      title={title}
    >
      <Phone className="size-2.5 shrink-0 text-muted-foreground/90" aria-hidden />
      <span className="min-w-0 truncate font-medium tabular-nums text-foreground/75">{shown}</span>
    </span>
  );
}

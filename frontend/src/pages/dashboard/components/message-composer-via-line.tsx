import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationHeaderData } from "@/types/repositories";

/** Phone icon + line number for the composer (no inbox chip). */
export function MessageComposerViaLine({
  connection,
  className,
}: {
  connection: NonNullable<ConversationHeaderData["whatsappConnection"]>;
  className?: string;
}) {
  const phone = connection.phoneNumber?.trim() ?? "";
  const hasPhone = phone.length > 0;
  const title = hasPhone ? `${connection.displayName} · ${phone}` : connection.displayName;
  return (
    <p
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-2 truncate text-xs text-muted-foreground",
        className,
      )}
      title={title}
    >
      <Phone className="size-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 truncate tabular-nums text-foreground/80">{hasPhone ? phone : "—"}</span>
    </p>
  );
}

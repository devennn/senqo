import { Link } from "react-router-dom";
import { CheckCheck, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ConversationListConnectionLine } from "@/components/layout/conversation-list-connection";
import {
  conversationListDisplayName,
  conversationListInitials,
  getConversationListPreviewParts,
  conversationListTimestamp,
} from "@/components/layout/conversation-list-utils";
import type {
  ConversationLabelBadge,
  ConversationSummary,
} from "@/types/repositories";

function isTestContactLabel(label: ConversationLabelBadge): boolean {
  const name = label.name.trim().toLowerCase();
  return name === "test" || name === "test contact";
}

export function ConversationListRow({
  conversation: c,
  to,
  isActive,
  isNew,
}: {
  conversation: ConversationSummary;
  to: string;
  isActive: boolean;
  isNew?: boolean;
}) {
  const avatarUrl = c.contact?.avatarUrl ?? null;
  const labels = c.labels ?? [];
  const isTestContact = labels.some(isTestContactLabel);
  const preview = getConversationListPreviewParts(c);
  const previewBodyTrimmed =
    c.lastMessage?.content?.replace(/\s+/g, " ").trim() ?? "";
  const showOutboundDoubleTick =
    !c.isGroup &&
    c.lastMessage?.isOutbound === true &&
    previewBodyTrimmed.length > 0;
  return (
    <Link
      to={to}
      className={cn(
        "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-accent/80",
        isActive && "bg-accent shadow-sm ring-1 ring-primary/10",
        isNew && !isActive && "animate-conversation-flash",
      )}
    >
      <Avatar className="size-12 shrink-0 rounded-full">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-full text-sm font-semibold">
          {c.isGroup ? (
            <Users className="size-5 text-muted-foreground" />
          ) : (
            conversationListInitials(c)
          )}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {isTestContact ? (
              <Badge
                variant="secondary"
                className="shrink-0 font-normal"
                title="Test contact"
              >
                Test
              </Badge>
            ) : null}
            <span className="min-w-0 truncate text-[0.95rem] font-semibold leading-tight">
              {conversationListDisplayName(c)}
            </span>
          </div>
          <div className="flex shrink-0 items-baseline gap-2">
            {c.whatsappConnection ? (
              <ConversationListConnectionLine
                connection={c.whatsappConnection}
              />
            ) : null}
            <time
              className="text-xs tabular-nums text-muted-foreground"
              dateTime={c.lastMessage?.createdAt ?? c.updated_at}
            >
              {conversationListTimestamp(c)}
            </time>
          </div>
        </div>
        <p className="mt-0.5 flex min-w-0 max-w-full items-center gap-1 text-sm leading-snug text-muted-foreground">
          {showOutboundDoubleTick ? (
            <CheckCheck
              className="size-3.5 shrink-0 text-muted-foreground"
              strokeWidth={2.25}
              aria-hidden
            />
          ) : null}
          {preview.prefix ? (
            <>
              <span className="shrink-0 font-bold text-muted-foreground mr-1">
                {preview.prefix}
              </span>
              <span className="min-w-0 truncate font-normal text-muted-foreground">
                {preview.body}
              </span>
            </>
          ) : (
            <span className="min-w-0 truncate font-normal text-muted-foreground">
              {preview.body}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

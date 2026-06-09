import { useState } from "react";
import { Phone, Tag, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConversationLabelBadges } from "@/pages/dashboard/components/conversation-label-badges";
import { ConversationDeleteDialog } from "@/pages/dashboard/components/conversation-delete-dialog";
import { ConversationAgentLogsDialog } from "@/pages/dashboard/components/conversation-agent-logs-dialog";
import { ConversationUserLabelsDialog } from "@/pages/dashboard/components/conversation-user-labels-dialog";
import type { ConversationHeaderData, ConversationLabelRecord } from "@/types/repositories";

function initials(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

export function ConversationContactHeader({
  conversation,
  fallbackTitle,
  labelCatalog = [],
  onUserLabelsSaved,
  onDelete,
  isOwner = false,
}: {
  conversation: ConversationHeaderData | null;
  fallbackTitle?: string;
  labelCatalog?: ConversationLabelRecord[];
  onUserLabelsSaved?: () => void;
  onDelete?: () => void | Promise<void>;
  isOwner?: boolean;
}) {
  const [labelsOpen, setLabelsOpen] = useState(false);
  const title = conversation?.title ?? fallbackTitle ?? "Conversation";
  const isGroup = conversation?.isGroup === true;
  const contact = conversation?.contact;
  const displayName = isGroup
    ? conversation?.group?.subject || title
    : contact
    ? `${contact.firstName} ${contact.lastName}`.trim() || title
    : title;
  const phone = contact?.phone ?? null;
  const avatarUrl = contact?.avatarUrl ?? null;
  const labels = conversation?.labels ?? [];
  const groupSubtitle = isGroup
    ? [
        typeof conversation?.group?.size === "number" ? `${conversation.group.size} participants` : "WhatsApp group",
        conversation?.whatsappChatId ?? null,
      ].filter(Boolean).join(" - ")
    : null;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/60 bg-card/90 px-4 py-3 shadow-sm sm:gap-4 sm:px-6 sm:py-4">
      <Avatar size="lg" className="size-10 shrink-0 sm:size-12">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-base font-semibold">
          {isGroup ? <Users className="size-5" /> : contact ? initials(contact.firstName, contact.lastName) : title.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold tracking-tight">{displayName}</h1>
        {groupSubtitle ? (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Users className="size-3.5 shrink-0" />
            <span>{groupSubtitle}</span>
          </p>
        ) : phone ? (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            <span>{phone}</span>
          </p>
        ) : null}
      </div>
      {conversation ? (
        <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:max-w-[min(32rem,50vw)]">
          {labels.length > 0 ? (
            <ConversationLabelBadges labels={labels} maxVisible={labels.length} className="justify-end" />
          ) : null}
          {labelCatalog.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2 text-xs"
              onClick={() => setLabelsOpen(true)}
              disabled={!onUserLabelsSaved}
              aria-label="Manage labels"
              title="Manage labels"
            >
              <Tag className="size-3.5" />
              {labels.length === 0 ? "Add" : "Edit"}
            </Button>
          ) : null}
          {isOwner ? <ConversationAgentLogsDialog conversationId={conversation.id} /> : null}
          {onDelete ? <ConversationDeleteDialog onDelete={onDelete} /> : null}
        </div>
      ) : null}

      {conversation && labelCatalog.length > 0 && onUserLabelsSaved ? (
        <ConversationUserLabelsDialog
          open={labelsOpen}
          onOpenChange={setLabelsOpen}
          conversationId={conversation.id}
          catalog={labelCatalog}
          currentLabels={labels}
          onSaved={onUserLabelsSaved}
        />
      ) : null}
    </header>
  );
}

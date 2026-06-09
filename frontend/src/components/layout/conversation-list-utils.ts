import { formatConversationListTime } from "@/lib/format-conversation-list-time";
import type { ConversationListPreviewParts, ConversationSummary } from "@/types/repositories";

export const PREVIEW_MAX = 72;

export function conversationListDisplayName(c: ConversationSummary): string {
  if (c.isGroup) {
    return c.group?.subject || c.title || "WhatsApp group";
  }
  const contact = c.contact;
  if (contact) {
    const n = `${contact.firstName} ${contact.lastName}`.trim();
    if (n) return n;
    if (contact.phone) return contact.phone;
  }
  return "Unknown contact";
}

export function conversationListInitials(c: ConversationSummary): string {
  if (c.isGroup) {
    const title = c.group?.subject || c.title;
    return (
      title
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase() || "G"
    );
  }
  const contact = c.contact;
  if (contact) {
    const a = contact.firstName.trim().charAt(0);
    const b = contact.lastName.trim().charAt(0);
    const s = `${a}${b}`.toUpperCase();
    if (s) return s;
    return contact.phone.slice(-2).toUpperCase() || "?";
  }
  return "?";
}

export function getConversationListPreviewParts(
  c: ConversationSummary,
): ConversationListPreviewParts {
  const raw = c.lastMessage?.content?.replace(/\s+/g, " ").trim() ?? "";
  if (!raw) {
    return { prefix: null, body: "No messages yet" };
  }

  const label = c.isGroup
    ? (c.lastMessage?.groupPreviewSenderLabel?.trim() ?? "")
    : "";
  if (!label) {
    return {
      prefix: null,
      body: raw.length > PREVIEW_MAX ? `${raw.slice(0, PREVIEW_MAX)}…` : raw,
    };
  }

  const prefix = `${label}: `;
  const budget = Math.max(8, PREVIEW_MAX - prefix.length);
  const body = raw.length > budget ? `${raw.slice(0, budget)}…` : raw;
  return { prefix, body };
}

export function conversationListTimestamp(c: ConversationSummary): string {
  const iso = c.lastMessage?.createdAt ?? c.updated_at;
  return formatConversationListTime(iso);
}

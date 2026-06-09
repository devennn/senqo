/** Strips `@s.whatsapp.net` and device suffix (`:12`) from a WhatsApp JID local part. */
export function parsePhoneFromJid(jid: string): string {
  const local = (jid.split("@")[0] ?? "").split(":")[0] ?? "";
  return local.replace(/\D/g, "");
}

export function isGroupChatJid(jid: string | null | undefined): boolean {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

export function isBroadcastChatJid(jid: string | null | undefined): boolean {
  return typeof jid === "string" && jid.endsWith("@broadcast");
}

export function isNewsletterChatJid(jid: string | null | undefined): boolean {
  return typeof jid === "string" && jid.endsWith("@newsletter");
}

/** 1:1 DMs we persist as CRM conversations — not groups, channels, or broadcasts. */
export function isIngestableDmChatJid(jid: string | null | undefined): boolean {
  if (!jid?.trim()) return false;
  if (isGroupChatJid(jid)) return false;
  if (isBroadcastChatJid(jid)) return false;
  if (isNewsletterChatJid(jid)) return false;
  return true;
}

export function nonDmChatIgnoreMessage(jid: string): string {
  if (isGroupChatJid(jid)) return "ignored: group message";
  if (isNewsletterChatJid(jid)) return "ignored: channel message";
  if (isBroadcastChatJid(jid)) return "ignored: broadcast message";
  return "ignored: non-dm chat";
}

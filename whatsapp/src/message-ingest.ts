import { getHistoryMsg, type proto } from "baileys";
import { isIngestableDmChatJid } from "./jid.js";
import { unwrapMessage } from "./media.js";

export type MessageIngestSource = "notify" | "append";

/** Upsert types we ingest — `append` is offline / catch-up replay. */
export function isIngestableUpsertType(type: string): boolean {
  return type === "notify" || type === "append";
}

/**
 * Skip protocol rows that are not user-visible chat content (history sync
 * envelopes, empty stubs, etc.).
 */
export function shouldIngestBaileysMessage(msg: proto.IWebMessageInfo): boolean {
  const key = msg.key;
  if (!key?.id?.trim() || !key.remoteJid?.trim()) return false;
  if (!isIngestableDmChatJid(key.remoteJid)) return false;
  if (msg.message && getHistoryMsg(msg.message)) return false;
  return unwrapMessage(msg.message) != null;
}

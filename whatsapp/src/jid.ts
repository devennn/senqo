import { jidNormalizedUser, type Contact } from "baileys";
import { logger } from "./logger.js";

/**
 * JID / LID handling (Baileys v7).
 *
 * WhatsApp uses privacy LIDs (`<n>@lid`) alongside phone-number JIDs (PN:
 * `<digits>@s.whatsapp.net`). The backend derives CRM phone numbers from PN
 * JIDs only — unresolved LIDs must not be parsed as phone numbers.
 *
 * Mappings are stored per `connectionId` so multiple linked lines do not share
 * in-memory state. Sources: message key alts, `lid-mapping.update`, history
 * sync, contacts, groups, and `signalRepository.lidMapping` (see `lid-resolve.ts`).
 */

type ConnectionLidState = {
  lidToPn: Map<string, string>;
  pnToLid: Map<string, string>;
  /** Step 3 — contacts indexed by LID → PN JID from Contact.phoneNumber */
  contactPnByLid: Map<string, string>;
};

const byConnection = new Map<string, ConnectionLidState>();

function store(connectionId: string): ConnectionLidState {
  let s = byConnection.get(connectionId);
  if (!s) {
    s = { lidToPn: new Map(), pnToLid: new Map(), contactPnByLid: new Map() };
    byConnection.set(connectionId, s);
  }
  return s;
}

export function clearConnectionLidState(connectionId: string): void {
  byConnection.delete(connectionId);
}

export function isLidJid(jid: string | null | undefined): boolean {
  return typeof jid === "string" && jid.endsWith("@lid");
}

export function isGroupJid(jid: string | null | undefined): boolean {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

/** WhatsApp status / broadcast feeds (e.g. `status@broadcast`). */
export function isBroadcastJid(jid: string | null | undefined): boolean {
  return typeof jid === "string" && jid.endsWith("@broadcast");
}

/** WhatsApp channel feeds (e.g. `120363…@newsletter`). */
export function isNewsletterJid(jid: string | null | undefined): boolean {
  return typeof jid === "string" && jid.endsWith("@newsletter");
}

/** 1:1 DMs we persist as CRM conversations — not groups, channels, or broadcasts. */
export function isIngestableDmChatJid(jid: string | null | undefined): boolean {
  if (!jid?.trim()) return false;
  if (isGroupJid(jid)) return false;
  if (isBroadcastJid(jid)) return false;
  if (isNewsletterJid(jid)) return false;
  return true;
}

export function isUserJid(jid: string | null | undefined): boolean {
  return (
    typeof jid === "string" &&
    (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us") || jid.endsWith("@lid"))
  );
}

/** Digits of a JID local part (drops the `:device` suffix). Mirrors backend `parsePhoneFromJid`. */
export function jidDigits(jid: string): string {
  const local = (jid.split("@")[0] ?? "").split(":")[0] ?? "";
  return local.replace(/\D/g, "");
}

/** Normalize a JID (strip device id, lowercase domain) without throwing. */
export function normalizeJid(jid: string | null | undefined): string {
  if (!jid) return "";
  try {
    return jidNormalizedUser(jid);
  } catch {
    return jid;
  }
}

/** Record a known LID <-> PN pairing (both normalized). */
export function learnMapping(
  connectionId: string,
  lidJid?: string | null,
  pnJid?: string | null,
): void {
  if (!lidJid || !pnJid) return;
  if (!isLidJid(lidJid)) return;
  if (isLidJid(pnJid)) return;
  const lid = normalizeJid(lidJid);
  const pn = normalizeJid(pnJid);
  if (!lid || !pn) return;
  const s = store(connectionId);
  if (s.lidToPn.get(lid) !== pn) {
    s.lidToPn.set(lid, pn);
    s.pnToLid.set(pn, lid);
    logger.debug({ connectionId, lid, pn }, "learned lid<->pn mapping");
  }
}

export function learnFromLidMapping(
  connectionId: string,
  mapping: { lid: string; pn: string },
): void {
  learnMapping(connectionId, mapping.lid, mapping.pn);
}

/**
 * Resolve any JID to its phone-number JID when possible (sync, in-memory only).
 * For full Baileys v7 resolution use `resolveIdentifierToPn` in `lid-resolve.ts`.
 */
export function resolveToPn(
  connectionId: string,
  jid: string | null | undefined,
  hints?: { lookup?: (lid: string) => string | undefined },
): { jid: string; lid?: string } {
  if (!jid) return { jid: "" };
  const norm = normalizeJid(jid);
  if (!isLidJid(norm)) {
    const lid = store(connectionId).pnToLid.get(norm);
    return lid ? { jid: norm, lid } : { jid: norm };
  }
  const s = store(connectionId);
  const mapped = s.lidToPn.get(norm) ?? s.contactPnByLid.get(norm) ?? hints?.lookup?.(norm);
  if (mapped && !isLidJid(mapped)) {
    return { jid: normalizeJid(mapped), lid: norm };
  }
  return { jid: norm, lid: norm };
}

type AnyKey = {
  remoteJid?: string | null;
  participant?: string | null;
  remoteJidAlt?: string | null;
  participantAlt?: string | null;
  senderPn?: string | null;
  participantPn?: string | null;
  senderLid?: string | null;
  participantLid?: string | null;
};

/** Step 1 — learn from message key alt PN fields (Baileys v7 `remoteJidAlt` / `participantAlt`). */
export function learnFromMessageKey(
  connectionId: string,
  key: AnyKey | null | undefined,
): void {
  if (!key) return;
  learnMapping(connectionId, key.remoteJid, key.remoteJidAlt);
  learnMapping(connectionId, key.remoteJidAlt, key.remoteJid);
  learnMapping(connectionId, key.senderLid, key.senderPn);
  learnMapping(connectionId, key.participant, key.participantAlt);
  learnMapping(connectionId, key.participantAlt, key.participant);
  learnMapping(connectionId, key.participantLid, key.participantPn);
}

/**
 * Step 3 — index a Baileys v7 `Contact` (id + optional `phoneNumber` / `lid`).
 * Also supports legacy shapes with a `jid` field from older payloads.
 */
export function learnFromContact(
  connectionId: string,
  contact: Pick<Contact, "id" | "lid" | "phoneNumber" | "name" | "notify" | "verifiedName"> & {
    jid?: string | null;
  },
): void {
  if (!contact) return;

  if (contact.phoneNumber) {
    const pn = normalizeJid(contact.phoneNumber);
    const lid =
      (contact.lid && normalizeJid(contact.lid)) ||
      (isLidJid(contact.id) ? normalizeJid(contact.id) : undefined);
    if (lid && pn) {
      learnMapping(connectionId, lid, pn);
      store(connectionId).contactPnByLid.set(lid, pn);
    }
  }

  const candidates = [contact.id, contact.lid, contact.jid].filter(
    (j): j is string => typeof j === "string" && j.length > 0,
  );
  const lid = candidates.find(isLidJid);
  const pn = candidates.find((j) => !isLidJid(j) && isUserJid(j));
  if (lid && pn) learnMapping(connectionId, lid, pn);
}

export function getContactPnByLid(connectionId: string, lid: string): string | undefined {
  const norm = normalizeJid(lid);
  return store(connectionId).contactPnByLid.get(norm) ?? store(connectionId).lidToPn.get(norm);
}

/** Sync lookup over the per-connection learned map. */
export function lidLookupFactory(connectionId: string): (lid: string) => string | undefined {
  return (lid: string) => getContactPnByLid(connectionId, lid);
}

/** Build a `<digits>@s.whatsapp.net` JID from a phone number or partial chat id. */
export function phoneToUserJid(input: string): string {
  if (isGroupJid(input)) return input;
  if (input.includes("@")) {
    if (isLidJid(input)) return normalizeJid(input);
    return `${jidDigits(input)}@s.whatsapp.net`;
  }
  const digits = input.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

/** Resolve a chat id from the backend into a sendable Baileys JID. */
export function toSendableJid(chatId: string): string {
  if (isGroupJid(chatId)) return chatId;
  return phoneToUserJid(chatId);
}

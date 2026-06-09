import type { proto, WAMessageKey, WASocket } from "baileys";
import { logger } from "./logger.js";
import {
  getContactPnByLid,
  isGroupJid,
  isLidJid,
  learnFromMessageKey,
  learnMapping,
  normalizeJid,
  resolveToPn,
} from "./jid.js";

export type LidResolveResult = {
  jid: string;
  lid?: string;
  /** Which step produced the PN, if any */
  via?: "alt" | "memory" | "lidMapping" | "contact" | "unresolved";
};

function pnFromMessageKeyAlt(
  connectionId: string,
  lid: string,
  key: WAMessageKey | null | undefined,
): string | undefined {
  if (!key) return undefined;
  const normLid = normalizeJid(lid);

  const tryPair = (primary?: string | null, alt?: string | null): string | undefined => {
    if (!primary || !alt) return undefined;
    if (normalizeJid(primary) === normLid && !isLidJid(alt)) {
      learnMapping(connectionId, primary, alt);
      return normalizeJid(alt);
    }
    if (normalizeJid(alt) === normLid && !isLidJid(primary)) {
      learnMapping(connectionId, alt, primary);
      return normalizeJid(primary);
    }
    return undefined;
  };

  return (
    tryPair(key.remoteJid, key.remoteJidAlt) ??
    tryPair(key.participant, key.participantAlt) ??
    undefined
  );
}

function hasLidMappingStore(sock: WASocket): boolean {
  return (
    typeof sock.signalRepository === "object" &&
    sock.signalRepository !== null &&
    "lidMapping" in sock.signalRepository &&
    sock.signalRepository.lidMapping != null
  );
}

/**
 * Resolve a user identifier to a phone-number JID using the Baileys v7 pipeline:
 * 1. Message key alts (`remoteJidAlt` / `participantAlt`)
 * 2. `signalRepository.lidMapping.getPNForLID`
 * 3. Per-connection contact / learned map
 * 4. (Caller may send `requestPhoneNumber` — not done here)
 * 5. Unresolved → return LID as-is
 */
export async function resolveIdentifierToPn(
  connectionId: string,
  sock: WASocket,
  jid: string,
  key?: WAMessageKey | null,
): Promise<LidResolveResult> {
  const norm = normalizeJid(jid);
  if (!norm || isGroupJid(norm)) return { jid: norm || jid };
  if (!isLidJid(norm)) return { jid: norm };

  learnFromMessageKey(connectionId, key);

  const fromAlt = pnFromMessageKeyAlt(connectionId, norm, key);
  if (fromAlt) return { jid: fromAlt, lid: norm, via: "alt" };

  const sync = resolveToPn(connectionId, norm);
  if (!isLidJid(sync.jid)) return { jid: sync.jid, lid: norm, via: "memory" };

  if (hasLidMappingStore(sock)) {
    try {
      const pn = await sock.signalRepository.lidMapping.getPNForLID(norm);
      if (pn && !isLidJid(pn)) {
        const resolved = normalizeJid(pn);
        learnMapping(connectionId, norm, resolved);
        return { jid: resolved, lid: norm, via: "lidMapping" };
      }
    } catch (error) {
      logger.warn({ connectionId, lid: norm, error: String(error) }, "getPNForLID failed");
    }
  }

  const fromContact = getContactPnByLid(connectionId, norm);
  if (fromContact && !isLidJid(fromContact)) {
    return { jid: normalizeJid(fromContact), lid: norm, via: "contact" };
  }

  logger.warn(
    { connectionId, lid: norm },
    "could not resolve LID to a phone-number JID; emitting LID as-is",
  );
  return { jid: norm, lid: norm, via: "unresolved" };
}

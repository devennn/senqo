import { getContentType, type GroupMetadata, type proto, type WASocket } from "baileys";
import {
  isGroupJid,
  isLidJid,
  jidDigits,
  learnFromContact,
  learnMapping,
  normalizeJid,
} from "./jid.js";
import { resolveIdentifierToPn } from "./lid-resolve.js";
import { downloadMediaBase64, thumbnailBase64, unwrapMessage } from "./media.js";
import type {
  BackendMessageType,
  GroupParticipant,
  InboundMessageEvent,
  OutboundMirrorEvent,
  QuotedMessage,
  WhatsappBackendEvent,
} from "./types.js";

export type BuildContext = {
  connectionId: string;
  sock: WASocket;
  /** Resolved phone-number JID of the connected account. */
  selfJid: string;
  getGroupMetadata: (jid: string) => Promise<GroupMetadata | null>;
  getContactName: (jid: string) => string | undefined;
};

function tsToSeconds(ts: proto.IWebMessageInfo["messageTimestamp"]): number {
  if (ts == null) return Math.floor(Date.now() / 1000);
  if (typeof ts === "number") return ts;
  const maybeLong = ts as { toNumber?: () => number };
  if (typeof maybeLong.toNumber === "function") return maybeLong.toNumber();
  const n = Number(ts);
  return Number.isFinite(n) ? n : Math.floor(Date.now() / 1000);
}

type Extracted = {
  backendType: BackendMessageType;
  text?: string;
  caption?: string;
  mimeType?: string;
  fileName?: string;
  isMedia: boolean;
  thumbNode?: { jpegThumbnail?: Uint8Array | null };
  contextInfo?: proto.IContextInfo | null;
};

/** Classify a Baileys content message into the backend's message-type vocabulary. */
function classify(content: proto.IMessage): Extracted | null {
  const type = getContentType(content);
  switch (type) {
    case "conversation":
      return { backendType: "textMessage", text: content.conversation ?? "", isMedia: false };
    case "extendedTextMessage":
      return {
        backendType: "extendedTextMessage",
        text: content.extendedTextMessage?.text ?? "",
        isMedia: false,
        contextInfo: content.extendedTextMessage?.contextInfo,
      };
    case "imageMessage":
      return {
        backendType: "imageMessage",
        caption: content.imageMessage?.caption ?? undefined,
        mimeType: content.imageMessage?.mimetype ?? "image/jpeg",
        isMedia: true,
        thumbNode: content.imageMessage ?? undefined,
        contextInfo: content.imageMessage?.contextInfo,
      };
    case "videoMessage":
      return {
        backendType: "videoMessage",
        caption: content.videoMessage?.caption ?? undefined,
        mimeType: content.videoMessage?.mimetype ?? "video/mp4",
        isMedia: true,
        thumbNode: content.videoMessage ?? undefined,
        contextInfo: content.videoMessage?.contextInfo,
      };
    case "audioMessage":
      return {
        backendType: "audioMessage",
        mimeType: content.audioMessage?.mimetype ?? "audio/ogg",
        isMedia: true,
        contextInfo: content.audioMessage?.contextInfo,
      };
    case "documentMessage":
      return {
        backendType: "documentMessage",
        caption: content.documentMessage?.caption ?? undefined,
        mimeType: content.documentMessage?.mimetype ?? "application/octet-stream",
        fileName: content.documentMessage?.fileName ?? undefined,
        isMedia: true,
        thumbNode: content.documentMessage ?? undefined,
        contextInfo: content.documentMessage?.contextInfo,
      };
    case "stickerMessage":
      return {
        backendType: "imageMessage",
        mimeType: content.stickerMessage?.mimetype ?? "image/webp",
        fileName: "sticker.webp",
        isMedia: true,
        contextInfo: content.stickerMessage?.contextInfo,
      };
    default:
      return null;
  }
}

function buildQuoted(contextInfo: proto.IContextInfo | null | undefined): QuotedMessage | undefined {
  const quoted = contextInfo?.quotedMessage;
  if (!quoted) return undefined;
  const inner = unwrapMessage(quoted);
  const innerType = inner ? getContentType(inner) : undefined;
  const q: QuotedMessage = {
    stanzaId: contextInfo?.stanzaId ?? undefined,
    participant: contextInfo?.participant ?? undefined,
    typeMessage: innerType,
  };
  if (inner) {
    q.textMessage = inner.conversation ?? inner.extendedTextMessage?.text ?? undefined;
    q.caption =
      inner.imageMessage?.caption ??
      inner.videoMessage?.caption ??
      inner.documentMessage?.caption ??
      undefined;
    q.mimeType =
      inner.imageMessage?.mimetype ??
      inner.videoMessage?.mimetype ??
      inner.audioMessage?.mimetype ??
      inner.documentMessage?.mimetype ??
      undefined;
    q.fileName = inner.documentMessage?.fileName ?? undefined;
  }
  return q;
}

async function resolveUserJid(
  ctx: BuildContext,
  jid: string,
  key: proto.IMessageKey | null | undefined,
  explicitPn?: string | null,
): Promise<{ jid: string; lid?: string }> {
  if (explicitPn && !isLidJid(explicitPn)) {
    const pn = normalizeJid(explicitPn);
    if (isLidJid(jid)) learnMapping(ctx.connectionId, jid, pn);
    return { jid: pn, lid: normalizeJid(jid) };
  }
  return resolveIdentifierToPn(ctx.connectionId, ctx.sock, jid, key);
}

async function buildParticipants(
  ctx: BuildContext,
  groupJid: string,
): Promise<{ participants: GroupParticipant[]; meta: GroupMetadata | null }> {
  const meta = await ctx.getGroupMetadata(groupJid);
  if (!meta) return { participants: [], meta: null };
  const participants: GroupParticipant[] = await Promise.all(
    meta.participants.map(async (p) => {
      learnFromContact(ctx.connectionId, p);
      const resolved = await resolveUserJid(ctx, p.id, undefined, p.phoneNumber);
      const lid = p.lid ? normalizeJid(p.lid) : resolved.lid;
      return {
        id: resolved.jid,
        lid: lid || undefined,
        isAdmin: p.admin === "admin" || p.admin === "superadmin",
        isSuperAdmin: p.admin === "superadmin",
      };
    }),
  );
  return { participants, meta };
}

/**
 * Build a canonical `message.inbound` / `message.outbound_mirror` event from a
 * Baileys message, or `null` if the message type isn't ingested.
 */
export async function buildMessageEvent(
  ctx: BuildContext,
  msg: proto.IWebMessageInfo,
): Promise<WhatsappBackendEvent | null> {
  const key = msg.key;
  if (!key) return null;
  const remoteJid = key.remoteJid ?? "";
  const messageId = key.id ?? "";
  if (!remoteJid || !messageId) return null;

  const content = unwrapMessage(msg.message);
  if (!content) return null;

  const extracted = classify(content);
  if (!extracted) return null;

  const isGroup = isGroupJid(remoteJid);
  const fromMe = key.fromMe === true;

  const chatResolved = isGroup
    ? { jid: remoteJid, lid: undefined as string | undefined }
    : await resolveIdentifierToPn(ctx.connectionId, ctx.sock, remoteJid, key);
  const chatId = chatResolved.jid;

  const senderRaw = isGroup ? key.participant ?? "" : remoteJid;
  const senderResolved = isGroup
    ? await resolveIdentifierToPn(ctx.connectionId, ctx.sock, senderRaw, key)
    : chatResolved;
  const sender = senderResolved.jid || chatId;

  const timestamp = tsToSeconds(msg.messageTimestamp);
  const senderName = msg.pushName ?? undefined;

  let backendType = extracted.backendType;
  let quoted: QuotedMessage | undefined;
  if (!extracted.isMedia && extracted.contextInfo?.quotedMessage) {
    quoted = buildQuoted(extracted.contextInfo);
    if (quoted) backendType = "quotedMessage";
  }

  const base = {
    connectionId: ctx.connectionId,
    messageId,
    chatId,
    sender: sender || chatId,
    senderName,
    wid: ctx.selfJid,
    messageType: backendType,
    text: extracted.text?.length ? extracted.text : undefined,
    caption: extracted.caption,
    mimeType: extracted.mimeType,
    fileName: extracted.fileName,
    quoted,
    timestamp,
    isGroup,
  };

  if (extracted.isMedia) {
    const b64 = await downloadMediaBase64(ctx.sock, msg);
    if (b64) {
      (base as { mediaBase64?: string }).mediaBase64 = b64;
      (base as { jpegThumbnail?: string }).jpegThumbnail = thumbnailBase64(extracted.thumbNode);
    }
  }

  if (isGroup) {
    const { participants, meta } = await buildParticipants(ctx, remoteJid);
    const ownerPn = meta?.ownerPn;
    const ownerResolved = ownerPn
      ? { jid: normalizeJid(ownerPn) }
      : meta?.owner
        ? await resolveIdentifierToPn(ctx.connectionId, ctx.sock, meta.owner, undefined)
        : { jid: undefined as string | undefined };
    const group = {
      groupId: remoteJid,
      subject: meta?.subject ?? undefined,
      owner: ownerResolved.jid,
      size: meta ? meta.participants.length : undefined,
      creation: meta?.creation ?? undefined,
      subjectOwner: meta?.subjectOwnerPn
        ? normalizeJid(meta.subjectOwnerPn)
        : meta?.subjectOwner ?? undefined,
    };
    Object.assign(base, {
      group,
      participants,
      chatName: meta?.subject ?? undefined,
    });
  }

  if (fromMe) {
    return { type: "message.outbound_mirror", ...base } as OutboundMirrorEvent;
  }

  if (!isGroup) {
    const contactName = ctx.getContactName(chatId);
    const resolvedToPn = !isLidJid(chatId);
    (base as InboundMessageEvent).contactInfo = {
      name: senderName,
      contactName,
      chatId,
      phoneNumber: resolvedToPn ? jidDigits(chatId) : undefined,
    };
  }
  return { type: "message.inbound", ...base } as InboundMessageEvent;
}

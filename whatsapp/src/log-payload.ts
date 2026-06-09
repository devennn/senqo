import { getContentType, type proto } from "baileys";
import type { QuotedMessage, WhatsappBackendEvent } from "./types.js";

const INLINE_FIELD_LOG_MAX = 200;

function truncateInline(value: string | undefined, label: string): string | undefined {
  if (value == null) return undefined;
  if (value.length <= INLINE_FIELD_LOG_MAX) return value;
  return `${value.slice(0, INLINE_FIELD_LOG_MAX)}… (${label} ${value.length} chars, truncated for logs)`;
}

function quotedForLog(quoted: QuotedMessage | undefined): QuotedMessage | undefined {
  if (!quoted) return undefined;
  return {
    ...quoted,
    jpegThumbnail: truncateInline(quoted.jpegThumbnail, "jpegThumbnail"),
  };
}

/** Canonical webhook event safe for logs — all fields kept except huge base64 blobs. */
export function eventPayloadForLog(event: WhatsappBackendEvent): WhatsappBackendEvent {
  if (event.type !== "message.inbound" && event.type !== "message.outbound_mirror") {
    return event;
  }
  return {
    ...event,
    mediaBase64: truncateInline(event.mediaBase64, "mediaBase64"),
    jpegThumbnail: truncateInline(event.jpegThumbnail, "jpegThumbnail"),
    quoted: quotedForLog(event.quoted),
  };
}

function bytesSummary(data: Uint8Array | null | undefined): { byteLength: number } | undefined {
  if (data == null || data.length === 0) return undefined;
  return { byteLength: data.length };
}

/** Baileys `messages.upsert` row — key + metadata + message shape without binary payloads. */
export function baileysMessageForLog(msg: proto.IWebMessageInfo): Record<string, unknown> {
  const content = msg.message;
  const contentType = content ? getContentType(content) : undefined;
  return {
    key: msg.key,
    messageTimestamp: msg.messageTimestamp,
    pushName: msg.pushName,
    status: msg.status,
    participant: msg.participant,
    contentType,
    message: content ? summarizeBaileysContent(content, contentType) : undefined,
  };
}

function summarizeBaileysContent(
  content: proto.IMessage,
  contentType: keyof proto.IMessage | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { contentType };
  if (!contentType) return out;

  const node = content[contentType] as Record<string, unknown> | null | undefined;
  if (!node || typeof node !== "object") return out;

  for (const [k, v] of Object.entries(node)) {
    if (v instanceof Uint8Array) {
      out[k] = bytesSummary(v);
      continue;
    }
    if (typeof v === "string" && v.length > INLINE_FIELD_LOG_MAX) {
      out[k] = truncateInline(v, k);
      continue;
    }
    if (k === "contextInfo" && v && typeof v === "object") {
      const ctx = v as proto.IContextInfo;
      out.contextInfo = {
        ...ctx,
        quotedMessage: ctx.quotedMessage ? "[quotedMessage present]" : undefined,
      };
      continue;
    }
    out[k] = v;
  }
  return out;
}

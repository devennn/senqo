import type { ConversationMessageBareForAi } from "../types/repositories.js";
import {
  INBOUND_AI_MAX_MEDIA_PARTS,
  parseInboundMediaFromMetadata,
  type InboundMediaRaw,
} from "./inbound-media-to-model-parts.js";
import {
  THREAD_EVENT_HANDOFF_TO_HUMAN,
  THREAD_EVENT_MANUAL_TOGGLE,
} from "./conversation-thread-events.js";

/** Matches stored fallback content like `[imageMessage]` from WhatsApp inbound. */
export function isBareWhatsAppTypePlaceholderLine(line: string): boolean {
  return /^\[[A-Za-z]+\]$/.test(line.trim());
}

/**
 * Contiguous trailing inbound user rows (newest block at end of thread before last non-user).
 * Text lines are chronological; media descriptors are chronological, capped to INBOUND_AI_MAX_MEDIA_PARTS (most recent).
 */
export function collectTrailingUserBlockForAi(messages: ConversationMessageBareForAi[]): {
  textLines: string[];
  mediaDescriptors: InboundMediaRaw[];
  newestUserCreatedAt: string | null;
} {
  const textLinesRev: string[] = [];
  const mediaRev: InboundMediaRaw[] = [];
  let newestUserCreatedAt: string | null = null;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const row = messages[i];
    const metadata =
      row && typeof row.metadata === "object" && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : null;
    const threadEvent = typeof metadata?.thread_event === "string" ? metadata.thread_event : null;
    if (
      threadEvent === THREAD_EVENT_HANDOFF_TO_HUMAN ||
      threadEvent === THREAD_EVENT_MANUAL_TOGGLE
    ) {
      continue;
    }
    if (!row || row.role !== "user") break;
    if (newestUserCreatedAt === null) newestUserCreatedAt = row.created_at;
    const t = typeof row.content === "string" ? row.content.trim() : "";
    if (t.length > 0) textLinesRev.push(t);
    const raw = parseInboundMediaFromMetadata(row.metadata);
    if (raw) {
      mediaRev.push(raw);
    } else {
      const mt =
        metadata && typeof metadata.messageType === "string"
          ? metadata.messageType.trim()
          : "";
      if (mt === "audioMessage" || mt === "videoMessage" || mt === "documentMessage") {
        const mimeType =
          mt === "audioMessage"
            ? "audio/inbound-placeholder"
            : mt === "videoMessage"
              ? "video/inbound-placeholder"
              : "application/inbound-placeholder";
        mediaRev.push({
          storagePath: null,
          mimeType,
          fileName: null,
          thumbnailDataUrl: null,
        });
      }
    }
  }
  textLinesRev.reverse();
  mediaRev.reverse();

  const sliceStart = Math.max(0, mediaRev.length - INBOUND_AI_MAX_MEDIA_PARTS);
  const mediaDescriptors = mediaRev.slice(sliceStart);

  return { textLines: textLinesRev, mediaDescriptors, newestUserCreatedAt };
}

export function buildBatchedInboundAiPrompt(lines: string[]): string {
  const body = lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
  return (
    "The customer sent several WhatsApp messages in quick succession (possibly as separate bubbles). " +
    "Reply once in a single coherent message, addressing each numbered point clearly.\n\n" +
    body
  );
}

const ATTACHMENTS_ONLY_INSTRUCTION =
  "The customer sent one or more image attachments. Interpret the attached parts and reply helpfully in one WhatsApp message. If you cannot interpret an attachment, say so briefly.";

/** User-visible instruction string for the model (no media parts). */
export function buildInboundAiUserTextForRun(textLines: string[]): string {
  const substantive = textLines.filter((l) => !isBareWhatsAppTypePlaceholderLine(l));
  if (substantive.length === 0) {
    return ATTACHMENTS_ONLY_INSTRUCTION;
  }
  return buildBatchedInboundAiPrompt(substantive);
}

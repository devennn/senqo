import { Hono } from "hono";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { downloadIncomingMedia } from "../services/whatsapp-media.js";
import {
  getQrCode,
  sendTextMessageCompat,
  stopConnection,
  uploadAndSendMedia,
} from "../services/whatsapp-client.js";
import {
  isIngestableDmChatJid,
  nonDmChatIgnoreMessage,
  parsePhoneFromJid,
} from "../lib/whatsapp-jid.js";
import { env } from "../lib/env.js";
import {
  createConversationMessage,
  findConnectionByPhoneNumber,
  findOrCreateContactByPhone,
  findOrCreateConversationByWhatsappChatId,
  recordConnectionEvent,
  recordWebhookEvent,
  recordWebhookPayloadDump,
  removeConnectionFromWebhook,
  uploadIncomingMediaToStorage,
  updateConnectionSyncStateFromWebhook,
  updateConnectionSyncState,
  getConnectionByPublicId,
  getConnectionById,
} from "../repositories/whatsapp.js";
import {
  getConversationHandlingMode,
  signWhatsappMediaPathForInboundAi,
} from "../repositories/conversations.js";
import { getContactIsTestForConversation } from "../repositories/contacts.js";
import {
  INBOUND_AI_MAX_MEDIA_PARTS,
  buildInboundUserMediaWireParts,
  isInboundImageMimeType,
  parseInboundMediaFromMetadata,
} from "../lib/inbound-media-to-model-parts.js";
import { resolveInboundMediaSigned } from "../lib/inbound-media-resolve.js";
import { scheduleInboundAiDebounced } from "../services/inbound-ai-debounce-schedule.js";
import { runAgentSession } from "../agent/agent.js";
import {
  persistHumanOutboundMediaToAgentSession,
  persistHumanOutboundTextToAgentSession,
} from "../services/conversation-persist.js";
import {
  normalizeWhatsappConnectionMode,
  shouldRunInboundAi,
} from "../services/inbound-ai-mode.js";
import { buildWhatsappQuotedMetadata } from "../lib/whatsapp-quoted-metadata.js";
import { getWorkspaceOwnerEmail } from "../repositories/profiles.js";
import { sendWhatsappDisconnectEmail } from "../services/email.js";
import { whatsappEventSchema } from "../types/whatsapp-events.js";
import type {
  WhatsappBackendEvent,
  WhatsappMessageEvent,
} from "../types/whatsapp-events.js";
import type { ResolveConnectionResult } from "../types/api-whatsapp-send.js";

type ContactInfoPayload = NonNullable<Extract<WhatsappMessageEvent, { type: "message.inbound" }>["contactInfo"]>;
import type { StoredUserImageUrlPart } from "../types/agent-multimodal.js";
import type { WhatsappConnectionMode, WhatsappContactInfoInput } from "../types/repositories.js";

const app = new Hono();

// ── Webhook ──────────────────────────────────────────────────────────────────

const scope = "WhatsAppWebhook";

function trace(step: string, details?: Record<string, unknown>): void {
  if (details) {
    console.log(`[${scope}] ${step}`, details);
    return;
  }
  console.log(`[${scope}] ${step}`);
}

function getBearerToken(authHeader: string | undefined): string {
  const match = (authHeader ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

/** WhatsApp/Green privacy labels like "+60∙∙∙∙∙∙∙55" use repeated bullet dots; skip those as display names. */
function looksLikeMaskedContactLabel(text: string): boolean {
  if (/\u2219{2,}/u.test(text)) return true;
  if (/\.\.\./u.test(text) || /\u2026/u.test(text)) return true;
  return false;
}

function isSupportedIncomingMessageType(type: string): boolean {
  return [
    "textMessage",
    "extendedTextMessage",
    "quotedMessage",
    "imageMessage",
    "documentMessage",
    "videoMessage",
    "audioMessage",
  ].includes(type);
}

function toRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function toHumanReadableWebhookTimestamp(timestamp: unknown): string | null {
  const parsed = Number(timestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const date = new Date(parsed * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Pick display label for a contact. */
function contactDisplayNameFromInfo(
  chatId: string,
  fallback?: string | null,
  contactInfo?: ContactInfoPayload | null,
): string {
  // (1) e.g. "Deven"
  const name = contactInfo?.name?.trim();
  if (name) return name;

  // (2) e.g. "Mom"; skip masked e.g. "+60∙∙∙∙∙∙∙55"
  const contactName = contactInfo?.contactName?.trim();
  if (contactName && !looksLikeMaskedContactLabel(contactName))
    return contactName;

  // (3) e.g. "60128361055"
  const digitsFromPhone = (contactInfo?.phoneNumber ?? "").replace(/\D/g, "");
  if (digitsFromPhone) return digitsFromPhone;

  // (4) e.g. webhook senderName "Alex"
  const fb = fallback?.trim();
  if (fb) return fb;

  // (5) then (6) default — e.g. "60128361055" or "WhatsApp Contact"
  return (
    parsePhoneFromJid(contactInfo?.chatId || chatId) || "WhatsApp Contact"
  );
}

function contactMetadataFromInfo(
  contactInfo: ContactInfoPayload | null,
): WhatsappContactInfoInput | undefined {
  if (!contactInfo) return undefined;
  return {
    whatsappChatId: contactInfo.chatId ?? null,
    contactName: contactInfo.contactName?.trim() || null,
    profileName: contactInfo.name?.trim() || null,
    email: null,
    avatarUrl: contactInfo.avatar?.trim() || null,
    isBusiness:
      typeof contactInfo.isBusiness === "boolean"
        ? contactInfo.isBusiness
        : null,
    category: null,
    description: null,
  };
}

type Connection = {
  id: string;
  workspace_id: string;
  display_name: string | null;
  phone_number: string | null;
  agent_config_id: string | null;
  mode: WhatsappConnectionMode;
};

async function handleConnectionStateEvent(
  event: Extract<WhatsappBackendEvent, { type: "connection.state" }>,
  connection: Connection,
): Promise<Response> {
  trace("handleConnectionStateEvent: start", {
    connectionId: event.connectionId,
    state: event.state,
  });
  if (event.state === "pending_qr") {
    try {
      const qrResult = await getQrCode(event.connectionId);
      if (qrResult.type === "qrCode") {
        await updateConnectionSyncState(connection.workspace_id, connection.id, {
          status: "pending_qr",
          qrCodePayload: qrResult.message,
          stateInstance: "notAuthorized",
        });
      }
    } catch (error) {
      console.error(`[${scope}/pending_qr] qr fetch failed: ${String(error)}`);
    }
    return Response.json({ received: true, message: "processed: pending_qr" });
  }
  if (event.state === "not_authorized") {
    const eventCreatedAt = toHumanReadableWebhookTimestamp(event.timestamp);
    const nameLabel = connection.display_name?.trim() || "Unnamed connection";
    const phoneLabel = connection.phone_number?.trim() || "unknown";
    await recordConnectionEvent({
      workspaceId: connection.workspace_id,
      connectionIdSnapshot: connection.id,
      displayName: connection.display_name,
      phoneNumber: connection.phone_number,
      eventType: "connection_disconnected",
      source: "webhook",
      stateInstance: "notAuthorized",
      statusInstance: null,
      message: `WhatsApp disconnected (webhook). Display name: ${nameLabel}. Phone: ${phoneLabel}. Reconnect from Connect when ready.`,
      createdAt: eventCreatedAt,
    });
    const ownerEmail = await getWorkspaceOwnerEmail(connection.workspace_id);
    if (ownerEmail) {
      try {
        await sendWhatsappDisconnectEmail({
          to: ownerEmail,
          displayName: connection.display_name,
          phoneNumber: connection.phone_number,
          disconnectedAt: eventCreatedAt,
        });
      } catch (err) {
        console.error(
          `[${scope}/disconnectEmail] Unexpected error: ${String(err)}`,
        );
      }
    }
    await removeConnectionFromWebhook(connection.workspace_id, connection.id);
    return Response.json({
      received: true,
      message: "processed: instance deauthorized",
    });
  }
  const phone = event.phone || connection.phone_number;

  const priorRow = await getConnectionById(
    connection.workspace_id,
    connection.id,
  );
  const wasNotYetAuthorized =
    priorRow === null || priorRow.last_state_instance !== "authorized";

  await updateConnectionSyncStateFromWebhook(connection.id, {
    status: "authorized",
    phoneNumber: phone ?? null,
    qrCodePayload: null,
    waAvatarUrl: event.avatarUrl || null,
    waDeviceId: event.deviceId || null,
    stateInstance: "authorized",
    statusInstance: null,
  });

  if (wasNotYetAuthorized) {
    await recordConnectionEvent({
      workspaceId: connection.workspace_id,
      connectionIdSnapshot: connection.id,
      displayName: connection.display_name,
      phoneNumber: phone || connection.phone_number,
      eventType: "connection_authorized",
      source: "webhook",
      stateInstance: "notAuthorized",
      statusInstance: null,
      message: "WhatsApp connected successfully.",
      createdAt: toHumanReadableWebhookTimestamp(event.timestamp),
    });
  }
  return Response.json({
    received: true,
    message: "processed: instance state synced",
  });
}

type IncomingInput = {
  webhookType: "message.inbound" | "message.outbound_mirror";
  event: WhatsappMessageEvent;
  connection: Connection;
};
type FileData = {
  downloadUrl?: string;
  base64?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
  jpegThumbnail?: string;
};

function mediaKindForOutgoingWebhook(messageType: string, mimeType: string): "file" | "image" | "audio" {
  const mt = mimeType.trim().toLowerCase();
  if (messageType === "audioMessage" || mt.startsWith("audio/")) return "audio";
  if (messageType === "imageMessage" || mt.startsWith("image/")) return "image";
  return "file";
}

async function handleIncomingMessageReceived(
  input: IncomingInput,
): Promise<Response> {
  const event = input.event;
  const senderChatId = event.chatId;
  if (!isIngestableDmChatJid(senderChatId)) {
    return Response.json({
      received: true,
      message: nonDmChatIgnoreMessage(senderChatId),
    });
  }
  const senderPhone = parsePhoneFromJid(senderChatId);
  const senderDisplayName =
    input.webhookType === "message.outbound_mirror"
      ? event.chatName?.trim() || event.chatId || "WhatsApp Contact"
      : event.senderName?.trim() || "WhatsApp Contact";
  const receiverChatId = event.wid;
  const receiverPhone = parsePhoneFromJid(receiverChatId);
  const webhookMessageId = event.messageId;
  const messageType = event.messageType;
  const fileData: FileData | undefined =
    event.mediaBase64 || event.mediaUrl
      ? {
          downloadUrl: event.mediaUrl || undefined,
          base64: event.mediaBase64,
          mimeType: event.mimeType,
          fileName: event.fileName,
          caption: event.caption,
          jpegThumbnail: event.jpegThumbnail,
        }
      : undefined;
  const messageTimestamp = toHumanReadableWebhookTimestamp(event.timestamp);
  const inboundContactInfo =
    input.webhookType === "message.inbound" && "contactInfo" in event
      ? event.contactInfo ?? null
      : null;

  if (
    !senderChatId ||
    !senderPhone ||
    !receiverChatId ||
    !receiverPhone ||
    !webhookMessageId
  ) {
    return Response.json({
      received: true,
      message: "ignored: missing incoming message identifiers",
    });
  }
  if (!isSupportedIncomingMessageType(messageType)) {
    return Response.json({
      received: true,
      message: "ignored: unsupported incoming message type",
    });
  }

  let receiverConnection = await findConnectionByPhoneNumber(
    input.connection.workspace_id,
    receiverPhone,
  );
  const receiverLookupMiss =
    !receiverConnection.workspace_id || receiverConnection.id !== input.connection.id;
  if (receiverLookupMiss) {
    trace("handleIncomingMessageReceived: using webhook instance connection for receiver", {
      instanceConnectionId: input.connection.id,
      receiverPhone,
      lookupId: receiverConnection.id || null,
    });
    receiverConnection = {
      id: input.connection.id,
      workspace_id: input.connection.workspace_id,
      phone_number: receiverPhone,
      agent_config_id: input.connection.agent_config_id,
      mode: input.connection.mode,
      status: null,
      last_state_instance: null,
    };
    if (receiverPhone && !input.connection.phone_number?.trim()) {
      await updateConnectionSyncState(input.connection.workspace_id, input.connection.id, {
        status: "authorized",
        phoneNumber: receiverPhone,
        stateInstance: "authorized",
      });
    }
  }

  const dedupe = await recordWebhookEvent({
    workspaceId: input.connection.workspace_id,
    connectionId: null,
    dedupeKey: `${input.webhookType}:${webhookMessageId}`,
    webhookType: input.webhookType,
    payload: toRecord(event),
  });
  if (dedupe.duplicate)
    return Response.json({
      received: true,
      message: "ignored: duplicate incoming message",
    });

  const contactInfo = inboundContactInfo;
  const contactDisplayName = contactDisplayNameFromInfo(
    senderChatId,
    senderDisplayName,
    contactInfo,
  );

  const contact = await findOrCreateContactByPhone(
    input.connection.workspace_id,
    senderPhone,
    contactDisplayName,
    contactMetadataFromInfo(contactInfo),
  );
  if (!contact.id)
    return Response.json({
      received: true,
      message: "ignored: failed to resolve contact",
    });

  const conversationId = await findOrCreateConversationByWhatsappChatId(
    input.connection.workspace_id,
    input.connection.id,
    contact.id,
    contactDisplayName,
    senderChatId,
  );
  if (!conversationId)
    return Response.json({
      received: true,
      message: "ignored: failed to resolve conversation",
    });

  const metadata: Record<string, unknown> = {
    source: "whatsapp_webhook",
    webhookType: input.webhookType,
    messageType,
    webhookMessageId,
    senderChatId,
    receiverChatId,
    receiverPhone,
    whatsappConnectionId: input.connection.id,
  };
  if (messageType === "quotedMessage" && event.quoted) {
    const quotedMetadata = buildWhatsappQuotedMetadata(event.quoted);
    if (quotedMetadata) metadata.quoted = quotedMetadata;
  }

  let content = event.text?.trim() ?? "";

  if (
    !["textMessage", "extendedTextMessage", "quotedMessage"].includes(
      messageType,
    )
  ) {
    if (!fileData?.base64 && !fileData?.downloadUrl)
      return Response.json({
        received: true,
        message: "ignored: media payload missing content",
      });
    // Media arrives inlined as base64 from the WhatsApp service, or as a fetchable
    // URL. Prefer the inlined bytes when available.
    let mediaData: ArrayBuffer;
    let downloadedMimeType: string | null = null;
    if (fileData.base64) {
      const buffer = Buffer.from(fileData.base64, "base64");
      mediaData = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
    } else {
      const downloaded = await downloadIncomingMedia(fileData.downloadUrl as string);
      mediaData = downloaded.data;
      downloadedMimeType = downloaded.mimeType;
    }
    const uploadMimeType =
      fileData.mimeType || downloadedMimeType || "application/octet-stream";
    const uploadFileName = fileData.fileName || `${webhookMessageId}.bin`;
    const uploaded = await uploadIncomingMediaToStorage({
      workspaceId: input.connection.workspace_id,
      whatsappChatId: senderChatId,
      messageId: webhookMessageId,
      fileName: uploadFileName,
      mimeType: uploadMimeType,
      data: mediaData,
    });
    if (!uploaded.ok || !uploaded.path)
      return Response.json({
        received: true,
        message: "ignored: failed to store media",
      });
    metadata.media = {
      path: uploaded.path,
      fileName: uploadFileName,
      mimeType: uploadMimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      caption: fileData.caption || "",
      sourceUrl: fileData.downloadUrl ?? "",
      thumbnailDataUrl: fileData.jpegThumbnail
        ? `data:image/jpeg;base64,${fileData.jpegThumbnail}`
        : null,
    };
    content =
      (fileData as FileData & { caption?: string })?.caption?.trim() ||
      uploadFileName;
  }

  const created = await createConversationMessage(
    input.connection.workspace_id,
    conversationId,
    input.webhookType === "message.outbound_mirror" ? "assistant" : "user",
    content || `[${messageType}]`,
    metadata,
    "human",
    {
      createdAt: messageTimestamp,
    },
  );
  if (!created.ok)
    return Response.json({
      received: true,
      message: "ignored: failed to save message",
    });

  if (
    input.webhookType === "message.outbound_mirror" &&
    ["textMessage", "extendedTextMessage", "quotedMessage"].includes(messageType) &&
    content.trim().length > 0
  ) {
    const mirrored = await persistHumanOutboundTextToAgentSession({
      workspaceId: input.connection.workspace_id,
      conversationId,
      message: content,
      chatId: senderChatId,
      whatsappMessageId: webhookMessageId,
      whatsappConnectionId: input.connection.id,
      source: "whatsapp_outgoing_webhook",
    });
    if (!mirrored.ok) {
      console.error(
        `[${scope}] Failed query: agent mirror for outgoing webhook failed conversationId=${conversationId}`
      );
    }
  }

  if (input.webhookType === "message.outbound_mirror") {
    const rawMedia = metadata.media;
    if (rawMedia && typeof rawMedia === "object") {
      const media = rawMedia as Record<string, unknown>;
      const storagePath = typeof media.path === "string" ? media.path.trim() : "";
      const mimeType =
        typeof media.mimeType === "string" && media.mimeType.trim().length > 0
          ? media.mimeType.trim()
          : "application/octet-stream";
      const fileName =
        typeof media.fileName === "string" && media.fileName.trim().length > 0
          ? media.fileName.trim()
          : `${webhookMessageId || "attachment"}.bin`;
      const caption = typeof media.caption === "string" ? media.caption : "";

      let sourceUrl = "";
      if (storagePath.length > 0) {
        const signed = await signWhatsappMediaPathForInboundAi(
          input.connection.workspace_id,
          storagePath,
        );
        sourceUrl = signed?.trim() ?? "";
      }
      if (!sourceUrl && typeof media.sourceUrl === "string") {
        sourceUrl = media.sourceUrl.trim();
      }

      const mediaKind = mediaKindForOutgoingWebhook(messageType, mimeType);
      const mirroredMedia = await persistHumanOutboundMediaToAgentSession({
        workspaceId: input.connection.workspace_id,
        conversationId,
        chatId: senderChatId,
        whatsappMessageId: webhookMessageId,
        whatsappConnectionId: input.connection.id,
        fileName,
        mimeType,
        mediaKind,
        caption,
        sourceUrl,
        source: "whatsapp_outgoing_webhook",
      });
      if (!mirroredMedia.ok) {
        console.error(
          `[${scope}] Failed query: agent mirror for outgoing media webhook failed conversationId=${conversationId} messageType=${messageType}`
        );
      }
    }
  }

  if (
    input.webhookType === "message.inbound" &&
    input.connection.agent_config_id &&
    content.trim().length > 0
  ) {
    const handlingMode =
      (await getConversationHandlingMode(
        input.connection.workspace_id,
        conversationId,
      )) ?? "ai";
    const isTestContact = await getContactIsTestForConversation(
      input.connection.workspace_id,
      conversationId,
    );
    const connectionMode = normalizeWhatsappConnectionMode(input.connection.mode);
    const shouldRunAi = shouldRunInboundAi(
      connectionMode,
      isTestContact,
      handlingMode,
    );

    if (shouldRunAi) {
      void scheduleInboundAiDebounced({
        workspaceId: input.connection.workspace_id,
        conversationId,
        agentConfigId: input.connection.agent_config_id,
      });
    } else {
      const skipReason =
        handlingMode === "human"
          ? "conversation is in human handling mode"
          : connectionMode === "inactive"
            ? "connection mode is inactive"
            : connectionMode === "testing" && !isTestContact
              ? "connection mode is testing and contact is not marked as test"
              : "inference skipped by policy";
      console.info(
        `[${scope}] Contact not enqueued to job queue because ${skipReason}; persisting inbound to agent session conversationId=${conversationId}`,
      );
      let webhookSkipMessage = content;
      let webhookSkipUserMedia: StoredUserImageUrlPart[] | undefined;
      const parsedInboundMedia = parseInboundMediaFromMetadata(metadata);
      if (parsedInboundMedia) {
        const imageDescriptors = isInboundImageMimeType(parsedInboundMedia.mimeType)
          ? [parsedInboundMedia]
          : [];
        const resolved =
          imageDescriptors.length > 0
            ? await resolveInboundMediaSigned(
                input.connection.workspace_id,
                imageDescriptors,
              )
            : [];
        const imageWireParts = buildInboundUserMediaWireParts(resolved).slice(
          0,
          INBOUND_AI_MAX_MEDIA_PARTS,
        );
        if (metadata.media && imageWireParts.length === 0) {
          webhookSkipMessage +=
            "\n\n[System: the customer sent attachment(s), but they could not be attached for this AI run.]";
        }
        if (imageWireParts.length > 0) {
          webhookSkipUserMedia = imageWireParts;
        }
      }
      const persisted = await runAgentSession({
        workspaceId: input.connection.workspace_id,
        sessionId: conversationId,
        agentConfigId: input.connection.agent_config_id,
        message: webhookSkipMessage,
        messageTimestamp: messageTimestamp ?? undefined,
        dryRun: false,
        skipInference: true,
        skipInferenceReason: skipReason,
        userMediaParts: webhookSkipUserMedia,
      });
      if (!persisted) {
        console.error(
          `[${scope}] Failed to persist inbound message to agent session conversationId=${conversationId}`,
        );
      }
    }
  }

  return Response.json({
    received: true,
    message: "processed: incoming message saved",
  });
}

async function processSingleEvent(
  event: WhatsappBackendEvent,
  connection: Connection,
  rawWebhookJson: unknown,
): Promise<void> {
  await recordWebhookPayloadDump({
    workspaceId: connection.workspace_id,
    connectionId: connection.id,
    instanceId: event.connectionId,
    webhookType: event.type,
    payload: toRecord(rawWebhookJson),
  });

  if (event.type === "connection.state") {
    await handleConnectionStateEvent(event, connection);
    return;
  }
  if (event.type === "message.inbound" || event.type === "message.outbound_mirror") {
    await handleIncomingMessageReceived({
      webhookType: event.type,
      event,
      connection,
    });
    return;
  }
}

app.post("/events", async (c) => {
  const json = await c.req.json().catch(() => null);
  if (!json)
    return c.json({ received: true, message: "ignored: invalid json payload" });

  // The WhatsApp service posts canonical `WhatsappBackendEvent`s directly — a
  // single event per request, though an array is also accepted.
  const normalizedList: WhatsappBackendEvent[] = Array.isArray(json)
    ? (json as WhatsappBackendEvent[])
    : [json as WhatsappBackendEvent];

  // Resolve connection once — all events in a batch share the same connectionId.
  const firstEvent = normalizedList[0];
  if (!firstEvent) {
    return c.json({ received: true, message: "ignored: no events in batch" });
  }

  const connectionRow = await getConnectionByPublicId(firstEvent.connectionId);
  if (!connectionRow?.workspace_id) {
    void stopConnection(firstEvent.connectionId);
    return c.json({
      received: true,
      message: "ignored: connection not found; session stop requested",
    });
  }

  const connection: Connection = {
    id: connectionRow.id,
    workspace_id: connectionRow.workspace_id ?? "",
    display_name: connectionRow.display_name,
    phone_number: connectionRow.phone_number,
    agent_config_id: connectionRow.agent_config_id ?? null,
    mode: connectionRow.mode,
  };

  for (const event of normalizedList) {
    const parsed = whatsappEventSchema.safeParse(event);
    if (!parsed.success) {
      console.warn("[WhatsAppEvents/POST] invalid event payload", {
        eventType: event.type,
        connectionId: event.connectionId,
        issues: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 10),
      });
      continue;
    }
    await processSingleEvent(parsed.data, connection, json);
  }

  return c.json({
    received: true,
    message: `processed: ${normalizedList.length} event(s)`,
  });
});

// ── Send ─────────────────────────────────────────────────────────────────────

const sendTextSchema = z.object({
  connectionId: z.string().uuid(),
  chatId: z.string().min(5),
  message: z.string().min(1).max(20000),
});
const sendMediaSchema = z.object({
  connectionId: z.string().uuid(),
  chatId: z.string().min(5),
  caption: z.string().max(20000).optional(),
});

function getAuthToken(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  return (
    c.req.header("x-api-token") ??
    c.req.header("authorization")?.replace("Bearer ", "") ??
    ""
  );
}

async function resolveConnection(
  connectionId: string,
  token: string,
): Promise<ResolveConnectionResult> {
  const connection = await getConnectionByPublicId(connectionId);
  if (!connection?.id) {
    return {
      ok: false,
      response: Response.json(
        { error: "Connection not found" },
        { status: 404 },
      ),
    };
  }
  if (!connection.webhook_token || token.length !== connection.webhook_token.length) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!timingSafeEqual(Buffer.from(token), Buffer.from(connection.webhook_token))) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return {
    ok: true,
    value: { connectionId: connection.id },
  };
}

app.post("/send", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const token = getAuthToken(c);

  if (contentType.includes("application/json")) {
    const json = (await c.req.json()) as unknown;
    const parsed = sendTextSchema.safeParse(json);
    if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
    const resolved = await resolveConnection(parsed.data.connectionId, token);
    if (!resolved.ok)
      return new Response((resolved.response as Response).body, {
        status: (resolved.response as Response).status,
      });
    const result = await sendTextMessageCompat(resolved.value.connectionId, {
      chatId: parsed.data.chatId,
      text: parsed.data.message,
    });
    return c.json({ ok: true, idMessage: result.messageId });
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await c.req.formData();
    const parsed = sendMediaSchema.safeParse({
      connectionId: formData.get("connectionId"),
      chatId: formData.get("chatId"),
      caption: formData.get("caption"),
    });
    if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
    const file = formData.get("file");
    if (!(file instanceof File))
      return c.json({ error: "file is required" }, 400);
    const resolved = await resolveConnection(parsed.data.connectionId, token);
    if (!resolved.ok)
      return new Response((resolved.response as Response).body, {
        status: (resolved.response as Response).status,
      });
    const sent = await uploadAndSendMedia(resolved.value.connectionId, {
      chatId: parsed.data.chatId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      data: await file.arrayBuffer(),
      caption: parsed.data.caption,
    });
    return c.json({
      ok: true,
      idMessage: sent.messageId,
    });
  }

  return c.json({ error: "Unsupported content type" }, 415);
});

export default app;

/**
 * Canonical event shapes consumed by the backend's `POST /api/whatsapp/events`
 * route. These MUST stay in sync with `backend/src/types/whatsapp-events.ts`
 * (`whatsappEventSchema`). The backend ingests these directly at
 * `POST /api/whatsapp/events`, so we emit them verbatim — no adapter in between.
 */

export type ConnectionStateEvent = {
  type: "connection.state";
  connectionId: string;
  state: "authorized" | "not_authorized" | "pending_qr";
  phone?: string;
  avatarUrl?: string;
  deviceId?: string;
  timestamp: number;
};

export type QuotedMessage = {
  stanzaId?: string;
  participant?: string;
  typeMessage?: string;
  textMessage?: string;
  caption?: string;
  mimeType?: string;
  fileName?: string;
  jpegThumbnail?: string;
};

export type GroupParticipant = {
  id: string;
  lid?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
};

export type ContactInfo = {
  name?: string;
  contactName?: string;
  chatId?: string;
  phoneNumber?: string;
  avatar?: string;
  isBusiness?: boolean;
};

export type GroupInfo = {
  groupId: string;
  subject?: string;
  owner?: string;
  size?: number;
  creation?: number;
  subjectOwner?: string;
};

/** Backend message-type discriminators (see `isSupportedIncomingMessageType`). */
export type BackendMessageType =
  | "textMessage"
  | "extendedTextMessage"
  | "quotedMessage"
  | "imageMessage"
  | "videoMessage"
  | "audioMessage"
  | "documentMessage";

type MessageFields = {
  connectionId: string;
  messageId: string;
  chatId: string;
  sender: string;
  senderName?: string;
  chatName?: string;
  wid: string;
  messageType: BackendMessageType;
  text?: string;
  /** Inbound media inlined as base64 — backend decodes and stores to S3. */
  mediaBase64?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
  jpegThumbnail?: string;
  quoted?: QuotedMessage;
  timestamp: number;
  isGroup: boolean;
  group?: GroupInfo;
  participants?: GroupParticipant[];
};

export type InboundMessageEvent = MessageFields & {
  type: "message.inbound";
  contactInfo?: ContactInfo;
};

export type OutboundMirrorEvent = MessageFields & {
  type: "message.outbound_mirror";
};

export type WhatsappBackendEvent =
  | ConnectionStateEvent
  | InboundMessageEvent
  | OutboundMirrorEvent;

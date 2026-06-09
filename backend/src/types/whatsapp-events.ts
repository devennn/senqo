import { z } from "zod";

export const quotedMessageSchema = z.object({
  stanzaId: z.string().optional(),
  participant: z.string().optional(),
  typeMessage: z.string().optional(),
  textMessage: z.string().optional(),
  caption: z.string().optional(),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  jpegThumbnail: z.string().optional(),
});

export const contactInfoSchema = z.object({
  name: z.string().optional(),
  contactName: z.string().optional(),
  chatId: z.string().optional(),
  phoneNumber: z.string().optional(),
  avatar: z.string().optional(),
  isBusiness: z.boolean().optional(),
});

const messageFields = {
  connectionId: z.string().uuid(),
  messageId: z.string().min(1),
  chatId: z.string().min(1),
  sender: z.string().min(1),
  senderName: z.string().optional(),
  chatName: z.string().optional(),
  wid: z.string(),
  messageType: z.string(),
  text: z.string().optional(),
  mediaUrl: z.string().optional(),
  /** Inbound media inlined as base64 (the WhatsApp service downloads and inlines it). */
  mediaBase64: z.string().optional(),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  caption: z.string().optional(),
  jpegThumbnail: z.string().optional(),
  quoted: quotedMessageSchema.optional(),
  timestamp: z.number(),
};

export const whatsappEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("connection.state"),
    connectionId: z.string().uuid(),
    state: z.enum(["authorized", "not_authorized", "pending_qr"]),
    phone: z.string().optional(),
    avatarUrl: z.string().optional(),
    deviceId: z.string().optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("message.inbound"),
    contactInfo: contactInfoSchema.optional(),
    ...messageFields,
  }),
  z.object({
    type: z.literal("message.outbound_mirror"),
    ...messageFields,
  }),
]);

export type WhatsappBackendEvent = z.infer<typeof whatsappEventSchema>;
export type WhatsappMessageEvent = Extract<
  WhatsappBackendEvent,
  { type: "message.inbound" } | { type: "message.outbound_mirror" }
>;

import { env } from "./env.js";
import { eventPayloadForLog } from "./log-payload.js";
import { logger, logRawEventToCategory } from "./logger.js";
import type { WhatsappBackendEvent } from "./types.js";

function isMessageEvent(event: WhatsappBackendEvent): boolean {
  return event.type === "message.inbound" || event.type === "message.outbound_mirror";
}

function webhookUrl(): string {
  const base = env.backendWebhookUrl;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(env.webhookToken)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deliver one canonical event to the backend. Retries a few times with backoff —
 * the backend may briefly be unavailable on cold start. Never throws; a dropped
 * event is logged so it can be diagnosed.
 */
export async function deliverEvent(event: WhatsappBackendEvent): Promise<void> {
  const url = webhookUrl();
  const body = JSON.stringify(event);
  const maxAttempts = 4;
  const logPayload = isMessageEvent(event) ? eventPayloadForLog(event) : event;

  if (isMessageEvent(event)) {
    logger.info(
      { type: event.type, connectionId: event.connectionId, payload: logPayload },
      "webhook message payload",
    );
    const msg = event as Extract<typeof event, { type: "message.inbound" | "message.outbound_mirror" }>;
    const isGroup = "isGroup" in msg && msg.isGroup === true;
    logRawEventToCategory(event.type, isGroup, {
      connectionId: msg.connectionId,
      messageId: msg.messageId,
      chatId: msg.chatId,
      sender: msg.sender,
      senderName: msg.senderName,
      wid: msg.wid,
      messageType: msg.messageType,
      timestamp: msg.timestamp,
      isGroup,
    });
  } else {
    logRawEventToCategory(event.type, false, {
      connectionId: event.connectionId,
      ...(event.type === "connection.state" ? { state: event.state, phone: event.phone } : {}),
    });
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        logger.debug(
          { type: event.type, connectionId: event.connectionId, status: res.status },
          "webhook delivered",
        );
        return;
      }
      const responseText = await res.text().catch(() => "");
      logger.warn(
        {
          type: event.type,
          connectionId: event.connectionId,
          status: res.status,
          attempt,
          responseBody: responseText.slice(0, 2000) || undefined,
          payload: isMessageEvent(event) ? logPayload : undefined,
        },
        "webhook delivery non-2xx",
      );
    } catch (error) {
      logger.warn(
        {
          type: event.type,
          connectionId: event.connectionId,
          attempt,
          error: String(error),
          payload: isMessageEvent(event) ? logPayload : undefined,
        },
        "webhook delivery failed",
      );
    }
    if (attempt < maxAttempts) await sleep(250 * 2 ** (attempt - 1));
  }
  logger.error(
    {
      type: event.type,
      connectionId: event.connectionId,
      payload: logPayload,
    },
    "webhook delivery exhausted retries",
  );
}

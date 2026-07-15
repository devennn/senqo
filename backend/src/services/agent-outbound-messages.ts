import { sendAgentWhatsappMessage } from "./agent-whatsapp.js";

const scope = "AgentOutboundMessages";
const MAX_OUTBOUND_MESSAGES = 3;

export type PreparedOutboundMessage = {
  text: string;
  assetFileName: string;
};

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function dedupeKey(message: PreparedOutboundMessage): string {
  return `${normalizeText(message.text).toLowerCase()}\0${message.assetFileName}`;
}

/** Trim, drop empties, cap at 3, skip identical text+asset within the batch. */
export function prepareOutboundMessages(
  messages: Array<{ text?: string; assetFileName?: string }>,
): PreparedOutboundMessage[] {
  const prepared: PreparedOutboundMessage[] = [];
  const seen = new Set<string>();

  for (const raw of messages) {
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) continue;

    const assetFileName =
      typeof raw.assetFileName === "string" ? raw.assetFileName.trim() : "";
    const item: PreparedOutboundMessage = { text, assetFileName };

    const key = dedupeKey(item);
    if (seen.has(key)) {
      console.info(
        `[${scope}/prepareOutboundMessages] Skipping duplicate message text=${text.slice(0, 80)}`,
      );
      continue;
    }
    seen.add(key);
    prepared.push(item);
    if (prepared.length >= MAX_OUTBOUND_MESSAGES) break;
  }

  return prepared;
}

export type OutboundDelivery = PreparedOutboundMessage & {
  idMessage: string;
};

export async function sendPreparedOutboundMessages(input: {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
  messages: PreparedOutboundMessage[];
  dryRun?: boolean;
  agentRunId?: string;
}): Promise<{
  sent: number;
  messages: PreparedOutboundMessage[];
  deliveries: OutboundDelivery[];
}> {
  const messages = prepareOutboundMessages(input.messages);
  if (input.dryRun || !input.agentConfigId) {
    if (input.dryRun) {
      console.info(
        `[${scope}/sendPreparedOutboundMessages] Dry run: skipped send count=${messages.length}`,
      );
    }
    return { sent: 0, messages, deliveries: [] };
  }

  let sent = 0;
  const deliveries: OutboundDelivery[] = [];
  for (const message of messages) {
    const result = await sendAgentWhatsappMessage({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      agentConfigId: input.agentConfigId,
      message: message.text,
      ...(message.assetFileName ? { assetFileName: message.assetFileName } : {}),
      ...(input.agentRunId ? { agentRunId: input.agentRunId } : {}),
    });
    if (!result.ok) {
      console.error(
        `[${scope}/sendPreparedOutboundMessages] Failed query: send failed after=${sent} error=${result.error ?? "unknown"}`,
      );
      break;
    }
    sent += 1;
    const idMessage = result.idMessage ?? "";
    deliveries.push({ ...message, idMessage });
    console.info(
      `[${scope}/sendPreparedOutboundMessages] Sent bubble ${sent}/${messages.length}: idMessage=${idMessage} asset=${message.assetFileName} text=${message.text.slice(0, 200)}`,
    );
  }

  console.info(
    `[${scope}/sendPreparedOutboundMessages] Success: sent=${sent} prepared=${messages.length} conversationId=${input.conversationId}`,
  );
  return { sent, messages, deliveries };
}

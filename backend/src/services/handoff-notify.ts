import { phoneToWhatsappChatId } from "../lib/whatsapp-chat-id.js";
import { env } from "../lib/env.js";
import { getAgentConfigById } from "../repositories/agent.js";
import { getConversationWithContact } from "../repositories/conversations.js";
import { getHandoffPhone } from "../repositories/handoff-phones.js";
import { getWorkspaceRow } from "../repositories/workspaces.js";
import { getWhatsappConnectionRowById } from "../repositories/whatsapp.js";
import { sendTextMessageCompat as sendTextMessage } from "./whatsapp-client.js";

const scope = "HandoffNotify";

async function resolveAgentConfigId(
  workspaceId: string,
  conversationId: string,
  agentConfigId: string | null | undefined,
): Promise<string | null> {
  if (agentConfigId?.trim()) return agentConfigId.trim();
  const conversation = await getConversationWithContact(workspaceId, conversationId);
  const connectionId = conversation?.whatsappConnection?.id;
  if (!connectionId) return null;
  const connection = await getWhatsappConnectionRowById(workspaceId, connectionId);
  return connection?.agent_config_id?.trim() || null;
}

function formatAlertPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length > 0 ? `+${digits}` : null;
}

export function buildHandoffConversationOpenUrl(input: {
  frontendBaseUrl: string;
  workspaceId: string;
  conversationId: string;
}): string {
  const base = input.frontendBaseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    conversationId: input.conversationId,
    humanOnly: "1",
  });
  return `${base}/${input.workspaceId}/dashboard?${params.toString()}`;
}

export function buildHandoffAlertText(input: {
  workspaceName: string;
  workspaceId: string;
  conversationId: string;
  contactPhone: string | null;
  lineName: string | null;
  reason: string | null;
  frontendBaseUrl: string;
}): string {
  const reason = input.reason?.trim();
  const headline = reason
    ? `Senqo handoff: ${reason}`
    : "Senqo handoff: needs a human";
  const phone = formatAlertPhone(input.contactPhone);
  const line = input.lineName?.trim() || null;
  const openUrl = buildHandoffConversationOpenUrl({
    frontendBaseUrl: input.frontendBaseUrl,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  });
  const lines = [
    headline,
    "",
    phone ? `Phone: ${phone}` : null,
    line ? `Line: ${line}` : null,
    `Workspace: ${input.workspaceName}`,
    "",
    "Open in Senqo:",
    openUrl,
  ].filter((line) => line !== null);
  return lines.join("\n");
}

export type NotifyHandoffHumanInput = {
  workspaceId: string;
  conversationId: string;
  agentConfigId?: string | null;
  reason?: string | null;
};

/**
 * Fire-and-forget WhatsApp alerts. Never rejects — callers must not await this for
 * handoff correctness; conversation mode changes must succeed independently.
 */
export function scheduleHandoffNotify(input: NotifyHandoffHumanInput): void {
  void notifyHandoffHuman(input).catch((error) => {
    console.error(`[${scope}] Unexpected error: schedule ${String(error)}`);
  });
}

/** Sends WhatsApp alerts to each verified notify user on the conversation's line. Never throws. */
export async function notifyHandoffHuman(input: NotifyHandoffHumanInput): Promise<void> {
  try {
    const agentId = await resolveAgentConfigId(
      input.workspaceId,
      input.conversationId,
      input.agentConfigId,
    );
    if (!agentId) {
      console.info(
        `[${scope}] Skipped: no agent for conversationId=${input.conversationId}`,
      );
      return;
    }

    const agent = await getAgentConfigById(input.workspaceId, agentId);
    const notifyUserIds = Array.isArray(agent?.handoff_notify_user_ids)
      ? [...new Set(agent.handoff_notify_user_ids.map((id) => id.trim()).filter(Boolean))]
      : [];
    if (notifyUserIds.length === 0) {
      console.info(`[${scope}] Success: no notify users agentId=${agentId}`);
      return;
    }

    const conversation = await getConversationWithContact(
      input.workspaceId,
      input.conversationId,
    );
    const connectionId = conversation?.whatsappConnection?.id ?? null;
    if (!connectionId) {
      console.info(
        `[${scope}] Skipped: no conversation connection conversationId=${input.conversationId}`,
      );
      return;
    }

    const contactPhone = conversation?.contact?.phone ?? null;
    const lineName =
      conversation?.whatsappConnection?.displayName?.trim() ||
      conversation?.whatsappConnection?.phoneNumber?.trim() ||
      null;
    const workspace = await getWorkspaceRow(input.workspaceId);
    const workspaceName = workspace?.name?.trim() || input.workspaceId;
    const text = buildHandoffAlertText({
      workspaceName,
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      contactPhone,
      lineName,
      reason: input.reason ?? null,
      frontendBaseUrl: env.frontendUrl,
    });

    let notified = 0;
    for (const notifyUserId of notifyUserIds) {
      const phoneRow = await getHandoffPhone(
        input.workspaceId,
        notifyUserId,
        connectionId,
      );
      if (!phoneRow || phoneRow.status !== "verified") {
        console.info(
          `[${scope}] Skipped: no verified phone for connection userId=${notifyUserId} connectionId=${connectionId}`,
        );
        continue;
      }

      const chatId = phoneToWhatsappChatId(phoneRow.phone);
      if (!chatId) {
        console.info(`[${scope}] Skipped: invalid notify phone userId=${notifyUserId}`);
        continue;
      }

      try {
        await sendTextMessage(connectionId, { chatId, text });
        notified += 1;
      } catch (error) {
        console.error(
          `[${scope}] Unexpected error: send failed userId=${notifyUserId} ${String(error)}`,
        );
      }
    }

    console.info(
      `[${scope}] Success: notified=${notified}/${notifyUserIds.length} conversationId=${input.conversationId} connectionId=${connectionId}`,
    );
  } catch (error) {
    console.error(`[${scope}] Unexpected error: ${String(error)}`);
  }
}

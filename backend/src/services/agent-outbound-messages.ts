import { mediaKindFromMimeType } from "../lib/mime-media-kind.js";
import { getAgentConfigById } from "../repositories/agent.js";
import { getAgentAssetByFileNameForAgent } from "../repositories/workspace-asset-groups.js";
import { getWorkspaceButtonTemplateForSend } from "../repositories/button-templates.js";
import {
  createConversationMessage,
  recordFailedOutboundMessage,
} from "../repositories/whatsapp.js";
import { sendAgentWhatsappMessage } from "./agent-whatsapp.js";

const scope = "AgentOutboundMessages";
const MAX_OUTBOUND_MESSAGES = 3;

export type PreparedOutboundMessage = {
  text: string;
  assetFileName: string;
  buttonsTemplateId: string;
};

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function dedupeKey(message: PreparedOutboundMessage): string {
  return `${normalizeText(message.text).toLowerCase()}\0${message.assetFileName}\0${message.buttonsTemplateId}`;
}

/** Trim, drop empties, cap at 3, skip identical text+asset+buttons within the batch. */
export function prepareOutboundMessages(
  messages: Array<{
    text?: string;
    assetFileName?: string;
    buttonsTemplateId?: string;
  }>,
): PreparedOutboundMessage[] {
  const prepared: PreparedOutboundMessage[] = [];
  const seen = new Set<string>();

  for (const raw of messages) {
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) continue;

    const assetFileName =
      typeof raw.assetFileName === "string" ? raw.assetFileName.trim() : "";
    const buttonsTemplateId =
      typeof raw.buttonsTemplateId === "string"
        ? raw.buttonsTemplateId.trim()
        : "";
    const item: PreparedOutboundMessage = {
      text,
      assetFileName,
      buttonsTemplateId,
    };

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

/**
 * Dry runs: persist a reply the agent would have sent as a `dry_run` draft row.
 * Visible in the thread only; never delivered to WhatsApp.
 */
async function persistDryRunDraft(input: {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
  message: PreparedOutboundMessage;
  agentRunId?: string;
}): Promise<boolean> {
  let assetMetadata: Record<string, unknown> = {};
  if (input.message.assetFileName) {
    const agentConfig = await getAgentConfigById(input.workspaceId, input.agentConfigId);
    const groupIds = agentConfig?.asset_groups ?? [];
    const asset = await getAgentAssetByFileNameForAgent(
      input.workspaceId,
      groupIds,
      input.message.assetFileName,
    );
    assetMetadata =
      asset && asset.storage_path
        ? {
            mediaKind: mediaKindFromMimeType(asset.mime_type),
            media: {
              path: asset.storage_path,
              storageBucket: "agent-assets",
              fileName: asset.file_name,
              mimeType: asset.mime_type,
              caption: input.message.text || asset.file_name,
            },
          }
        : { dry_run_asset_missing: input.message.assetFileName };
  }

  let buttonMetadata: Record<string, unknown> = {};
  if (input.message.buttonsTemplateId) {
    const agentConfig = await getAgentConfigById(input.workspaceId, input.agentConfigId);
    const groupIds = agentConfig?.button_template_groups ?? [];
    const template = await getWorkspaceButtonTemplateForSend(
      input.workspaceId,
      groupIds,
      input.message.buttonsTemplateId,
    );
    buttonMetadata = template
      ? {
          button_template_id: template.id,
          button_template_title: template.title,
          buttons: template.buttons,
        }
      : { dry_run_button_template_missing: input.message.buttonsTemplateId };
  }

  const saved = await createConversationMessage(
    input.workspaceId,
    input.conversationId,
    "assistant",
    input.message.text,
    {
      source: "agent_dry_run",
      dry_run: true,
      ...(input.agentRunId ? { agent_run_id: input.agentRunId } : {}),
      ...assetMetadata,
      ...buttonMetadata,
    },
    "ai_agent",
    { status: "dry_run" },
  );
  return saved.ok && saved.created;
}

export async function sendPreparedOutboundMessages(input: {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
  messages: PreparedOutboundMessage[];
  dryRun?: boolean;
  /** Dry-run mode: persist drafts instead of sending. */
  draftRun?: boolean;
  agentRunId?: string;
}): Promise<{
  sent: number;
  drafts: number;
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
    return { sent: 0, drafts: 0, messages, deliveries: [] };
  }

  if (input.draftRun) {
    let drafts = 0;
    for (const message of messages) {
      const created = await persistDryRunDraft({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        agentConfigId: input.agentConfigId,
        message,
        ...(input.agentRunId ? { agentRunId: input.agentRunId } : {}),
      });
      if (!created) {
        console.error(
          `[${scope}/sendPreparedOutboundMessages] Failed query: could not persist dry-run draft after=${drafts} conversationId=${input.conversationId}`,
        );
        break;
      }
      drafts += 1;
    }
    console.info(
      `[${scope}/sendPreparedOutboundMessages] Dry run: persisted drafts=${drafts} prepared=${messages.length} conversationId=${input.conversationId}`,
    );
    return { sent: 0, drafts, messages, deliveries: [] };
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
      ...(message.buttonsTemplateId
        ? { buttonsTemplateId: message.buttonsTemplateId }
        : {}),
      ...(input.agentRunId ? { agentRunId: input.agentRunId } : {}),
    });
    if (!result.ok) {
      console.error(
        `[${scope}/sendPreparedOutboundMessages] Failed query: send failed after=${sent} error=${result.error ?? "unknown"}`,
      );
      await recordFailedOutboundMessage({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        content: message.text,
        outgoingSenderType: "ai_agent",
        errorMessage: result.error ?? null,
      });
      break;
    }
    sent += 1;
    const idMessage = result.idMessage ?? "";
    deliveries.push({ ...message, idMessage });
    console.info(
      `[${scope}/sendPreparedOutboundMessages] Sent bubble ${sent}/${messages.length}: idMessage=${idMessage} asset=${message.assetFileName} buttons=${message.buttonsTemplateId} text=${message.text.slice(0, 200)}`,
    );
  }

  console.info(
    `[${scope}/sendPreparedOutboundMessages] Success: sent=${sent} prepared=${messages.length} conversationId=${input.conversationId}`,
  );
  return { sent, drafts: 0, messages, deliveries };
}

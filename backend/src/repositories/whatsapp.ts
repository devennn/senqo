import { storageUpload } from "../lib/storage.js";
import { releaseWorkspaceStorage, reserveWorkspaceStorage } from "./workspace-storage.js";
import type {
  CreateConnectionInput,
  ConversationMessageCreateOptions,
  CreateConversationMessageResult,
  ManualWhatsappSendTarget,
  WhatsappContactInfoInput,
  WhatsappConnectionEvent,
  WhatsappConnectionEventInput,
  WhatsappConnection,
  WhatsappConnectionMode,
  WhatsappWebhookPayloadDumpInput,
} from "../types/repositories.js";
import { THREAD_EVENT_HANDOFF_TO_HUMAN } from "../lib/conversation-thread-events.js";
import { publish as publishRealtime } from "../lib/realtime-bus.js";
import { db } from "../db/index.js";
import {
  whatsappConnections,
  whatsappWebhookEvents,
  zzzWaDumps,
  whatsappConnectionEvents,
  contacts,
  conversations,
  messages,
} from "../db/schema/index.js";
import { eq, desc, asc, and, isNull, inArray, or, sql, not } from "drizzle-orm";

const WHATSAPP_MODES: readonly WhatsappConnectionMode[] = ["inactive", "testing", "live"];

function isWhatsappConnectionMode(value: string): value is WhatsappConnectionMode {
  return (WHATSAPP_MODES as readonly string[]).includes(value);
}

const scope = "WhatsappRepository";

/** Must match `025_whatsapp_connections_display_name_max_length.sql` (Postgres `char_length`). */
export const WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN = 120;

function mapConnectionRow(row: typeof whatsappConnections.$inferSelect): WhatsappConnection {
  const rawMode = row.mode as string | null | undefined;
  const mode: WhatsappConnectionMode =
    rawMode === "testing" || rawMode === "live" ? rawMode : "inactive";
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    agent_config_id: row.agentConfigId,
    mode,
    display_name: row.displayName,
    status: row.status ?? "pending_qr",
    phone_number: row.phoneNumber ?? null,
    qr_code_payload: row.qrCodePayload ?? null,
    webhook_token: row.webhookToken ?? null,
    wa_avatar_url: row.waAvatarUrl ?? null,
    wa_device_id: row.waDeviceId ?? null,
    last_state_instance: row.lastStateInstance ?? null,
    last_status_instance: row.lastStatusInstance ?? null,
    last_seen_at: row.lastSeenAt?.toISOString() ?? null,
    last_sync_at: row.lastSyncAt?.toISOString() ?? null,
  };
}

export async function listConnections(workspaceId: string): Promise<WhatsappConnection[]> {
  try {
    const data = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.workspaceId, workspaceId))
      .orderBy(desc(whatsappConnections.createdAt));
    console.info(`[${scope}/listConnections] Success: userId=${workspaceId}`);
    return data.map(mapConnectionRow);
  } catch (error) {
    console.error(`[${scope}/listConnections] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function getConnectionById(
  workspaceId: string,
  connectionId: string
): Promise<WhatsappConnection | null> {
  try {
    const data = await db
      .select()
      .from(whatsappConnections)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.id, connectionId),
        ),
      )
      .limit(1);
    const row = data[0] ?? null;
    if (!row) {
      console.info(`[${scope}/getConnectionById] Success: userId=${workspaceId}`);
      return null;
    }
    console.info(`[${scope}/getConnectionById] Success: userId=${workspaceId}`);
    return mapConnectionRow(row);
  } catch (error) {
    console.error(`[${scope}/getConnectionById] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function getConnectionByPublicId(connectionId: string): Promise<WhatsappConnection | null> {
  try {
    const data = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.id, connectionId))
      .limit(1);
    const row = data[0] ?? null;
    console.info(`[${scope}/getConnectionByPublicId] Success: userId=${String(row?.workspaceId ?? "")}`);
    return row ? mapConnectionRow(row) : null;
  } catch (error) {
    console.error(`[${scope}/getConnectionByPublicId] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function createConnection(input: CreateConnectionInput): Promise<{ ok: boolean; message: string; id: string | null }> {
  try {
    const trimmed = (input.displayName ?? "").trim();
    const displayName = trimmed.length > 0 ? trimmed : "Primary Device";
    if (displayName.length > WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN) {
      console.error(`[${scope}/createConnection] Failed query: display name too long`);
      return { ok: false, message: "display_name_too_long", id: null as string | null };
    }
    const result = await db
      .insert(whatsappConnections)
      .values({
        workspaceId: input.workspaceId,
        displayName,
        status: "pending_qr",
        qrCodePayload: input.qrCodePayload ?? null,
        webhookToken: input.webhookToken,
      })
      .returning({ id: whatsappConnections.id });
    const created = result[0];
    console.info(`[${scope}/createConnection] Success: userId=${input.workspaceId}`);
    return { ok: true, message: "Connection created", id: String(created.id) };
  } catch (error) {
    console.error(`[${scope}/createConnection] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error", id: null as string | null };
  }
}

export async function updateConnectionSyncState(
  workspaceId: string,
  connectionId: string,
  payload: {
    status?: string;
    phoneNumber?: string | null;
    qrCodePayload?: string | null;
    waAvatarUrl?: string | null;
    waDeviceId?: string | null;
    stateInstance?: string | null;
    statusInstance?: string | null;
  }
): Promise<{ ok: boolean; message: string }> {
  try {
    const updateRow: Record<string, string | null | Date> = {
      status: payload.status ?? null,
      phoneNumber: payload.phoneNumber ?? null,
      qrCodePayload: payload.qrCodePayload ?? null,
      waAvatarUrl: payload.waAvatarUrl ?? null,
      waDeviceId: payload.waDeviceId ?? null,
      lastStateInstance: payload.stateInstance ?? null,
      lastStatusInstance: payload.statusInstance ?? null,
      lastSyncAt: new Date(),
      lastSeenAt: payload.statusInstance === "online" ? new Date() : null,
    };
    const setValues: Record<string, string | null | Date> = {};
    for (const [key, value] of Object.entries(updateRow)) {
      if (value !== undefined) {
        setValues[key] = value;
      }
    }
    await db
      .update(whatsappConnections)
      .set(setValues)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.id, connectionId),
        ),
      );
    console.info(`[${scope}/updateConnectionSyncState] Success: userId=${workspaceId}`);
    return { ok: true, message: "Connection updated" };
  } catch (error) {
    console.error(`[${scope}/updateConnectionSyncState] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateConnectionMode(
  workspaceId: string,
  connectionId: string,
  mode: WhatsappConnectionMode
): Promise<{ ok: boolean; message: string }> {
  if (!isWhatsappConnectionMode(mode)) {
    console.error(`[${scope}/updateConnectionMode] Failed query: invalid mode`);
    return { ok: false, message: "Invalid mode" };
  }
  try {
    await db
      .update(whatsappConnections)
      .set({ mode })
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.id, connectionId),
        ),
      );
    console.info(
      `[${scope}/updateConnectionMode] Success: userId=${workspaceId} connectionId=${connectionId} mode=${mode}`
    );
    return { ok: true, message: "Connection mode updated" };
  } catch (error) {
    console.error(`[${scope}/updateConnectionMode] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateConnectionDisplayName(
  workspaceId: string,
  connectionId: string,
  displayName: string
): Promise<{ ok: boolean; message: string; displayName?: string; code?: "empty" | "too_long" }> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    console.error(`[${scope}/updateConnectionDisplayName] Failed query: display name empty`);
    return { ok: false, message: "Display name is required", code: "empty" };
  }
  if (trimmed.length > WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN) {
    console.error(`[${scope}/updateConnectionDisplayName] Failed query: display name too long`);
    return { ok: false, message: "Display name is too long", code: "too_long" };
  }
  try {
    await db
      .update(whatsappConnections)
      .set({ displayName: trimmed })
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.id, connectionId),
        ),
      );
    console.info(
      `[${scope}/updateConnectionDisplayName] Success: userId=${workspaceId} connectionId=${connectionId}`
    );
    return { ok: true, message: "Display name updated", displayName: trimmed };
  } catch (error) {
    console.error(`[${scope}/updateConnectionDisplayName] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function updateConnectionSyncStateFromWebhook(
  connectionId: string,
  payload: {
    status: "authorized" | "notAuthorized";
    phoneNumber?: string | null;
    qrCodePayload?: string | null;
    waAvatarUrl?: string | null;
    waDeviceId?: string | null;
    stateInstance: "authorized" | "notAuthorized";
    statusInstance?: string | null;
  }
): Promise<{ ok: boolean; message: string }> {
  try {
    await db
      .update(whatsappConnections)
      .set({
        status: payload.status,
        phoneNumber: payload.phoneNumber ?? null,
        qrCodePayload: payload.qrCodePayload ?? null,
        waAvatarUrl: payload.waAvatarUrl ?? null,
        waDeviceId: payload.waDeviceId ?? null,
        lastStateInstance: payload.stateInstance,
        lastStatusInstance: payload.statusInstance ?? null,
        lastSyncAt: new Date(),
        lastSeenAt: payload.statusInstance === "online" ? new Date() : null,
      })
      .where(eq(whatsappConnections.id, connectionId));
    console.info(`[${scope}/updateConnectionSyncStateFromWebhook] Success: userId=${connectionId}`);
    return { ok: true, message: "Connection updated" };
  } catch (error) {
    console.error(`[${scope}/updateConnectionSyncStateFromWebhook] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

/** Deletes a workspace WhatsApp connection row by id. */
export async function deleteConnectionByWorkspace(
  workspaceId: string,
  connectionId: string,
): Promise<{ ok: boolean; message: string; deleted: boolean }> {
  try {
    const deleted = await db
      .delete(whatsappConnections)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.id, connectionId),
        ),
      )
      .returning({ id: whatsappConnections.id });

    if (deleted.length === 0) {
      console.info(
        `[${scope}/deleteConnectionByWorkspace] Success: not found workspaceId=${workspaceId} connectionId=${connectionId}`,
      );
      return { ok: true, message: "Connection not found", deleted: false };
    }

    console.info(
      `[${scope}/deleteConnectionByWorkspace] Success: workspaceId=${workspaceId} connectionId=${connectionId}`,
    );
    return { ok: true, message: "Connection deleted", deleted: true };
  } catch (error) {
    console.error(`[${scope}/deleteConnectionByWorkspace] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error", deleted: false };
  }
}

/** Deletes the connection row when the WhatsApp service reports disconnect. */
export async function removeConnectionFromWebhook(
  workspaceId: string,
  connectionId: string,
): Promise<{ ok: boolean; message: string }> {
  const result = await deleteConnectionByWorkspace(workspaceId, connectionId);
  return { ok: result.ok, message: result.message };
}

export async function recordWebhookEvent(input: {
  workspaceId: string;
  connectionId?: string | null;
  dedupeKey: string;
  webhookType: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: boolean; duplicate: boolean }> {
  try {
    await db.insert(whatsappWebhookEvents).values({
      workspaceId: input.workspaceId,
      whatsappConnectionId: input.connectionId ?? null,
      dedupeKey: input.dedupeKey,
      webhookType: input.webhookType,
      payload: input.payload,
    });
    console.info(`[${scope}/recordWebhookEvent] Success: userId=${input.workspaceId}`);
    return { ok: true, duplicate: false };
  } catch (error) {
    const message = String(error);
    if (message.includes("duplicate key") || message.includes("23505")) {
      console.error(`[${scope}/recordWebhookEvent] Failed query: duplicate webhook`);
      return { ok: false, duplicate: true };
    }
    console.error(`[${scope}/recordWebhookEvent] Failed query: ${message}`);
    return { ok: false, duplicate: false };
  }
}

export async function recordWebhookPayloadDump(input: WhatsappWebhookPayloadDumpInput): Promise<{ ok: boolean }> {
  try {
    await db.insert(zzzWaDumps).values({
      workspaceId: input.workspaceId,
      whatsappConnectionId: input.connectionId,
      instanceId: input.instanceId,
      webhookType: input.webhookType,
      payload: input.payload,
    });
    console.info(`[${scope}/recordWebhookPayloadDump] Success: userId=${input.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/recordWebhookPayloadDump] Unexpected error: ${String(error)}`);
    return { ok: false };
  }
}

export async function recordConnectionEvent(input: WhatsappConnectionEventInput): Promise<{ ok: boolean }> {
  try {
    await db.insert(whatsappConnectionEvents).values({
      workspaceId: input.workspaceId,
      connectionIdSnapshot: input.connectionIdSnapshot ?? null,
      displayName: input.displayName ?? null,
      phoneNumber: input.phoneNumber ?? null,
      eventType: input.eventType,
      source: input.source,
      stateInstance: input.stateInstance ?? null,
      statusInstance: input.statusInstance ?? null,
      message: input.message,
      createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
    });
    console.info(`[${scope}/recordConnectionEvent] Success: userId=${input.workspaceId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/recordConnectionEvent] Unexpected error: ${String(error)}`);
    return { ok: false };
  }
}

export async function listRecentConnectionEvents(
  workspaceId: string,
  limit = 20
): Promise<WhatsappConnectionEvent[]> {
  try {
    const data = await db
      .select()
      .from(whatsappConnectionEvents)
      .where(eq(whatsappConnectionEvents.workspaceId, workspaceId))
      .orderBy(desc(whatsappConnectionEvents.createdAt))
      .limit(limit);
    console.info(`[${scope}/listRecentConnectionEvents] Success: userId=${workspaceId}`);
    return data.map((row) => ({
      id: row.id,
      workspace_id: row.workspaceId,
      connection_id_snapshot: row.connectionIdSnapshot ?? null,
      display_name: row.displayName ?? null,
      phone_number: row.phoneNumber ?? null,
      event_type: row.eventType as WhatsappConnectionEvent["event_type"],
      source: row.source as WhatsappConnectionEvent["source"],
      state_instance: row.stateInstance ?? null,
      status_instance: row.statusInstance ?? null,
      message: row.message,
      created_at: row.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error(`[${scope}/listRecentConnectionEvents] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function findOrCreateContactByPhone(
  workspaceId: string,
  phone: string,
  displayName?: string | null,
  contactInfo?: WhatsappContactInfoInput
): Promise<{ id: string | null; firstName: string; lastName: string }> {
  try {
    const names = (displayName ?? "WhatsApp").trim().split(/\s+/).filter(Boolean);
    const firstName = names[0] || "WhatsApp";
    const lastName = names.slice(1).join(" ");
    const contactMetadata: Record<string, unknown> = {
      source: "whatsapp_webhook",
      ...(contactInfo?.whatsappChatId ? { whatsapp_chat_id: contactInfo.whatsappChatId } : {}),
      ...(contactInfo?.contactName ? { contact_name: contactInfo.contactName } : {}),
      ...(contactInfo?.profileName ? { profile_name: contactInfo.profileName } : {}),
      ...(contactInfo?.email ? { email: contactInfo.email } : {}),
      ...(contactInfo?.avatarUrl ? { avatar_url: contactInfo.avatarUrl } : {}),
      ...(typeof contactInfo?.isBusiness === "boolean" ? { is_business: contactInfo.isBusiness } : {}),
      ...(contactInfo?.category ? { category: contactInfo.category } : {}),
      ...(contactInfo?.description ? { description: contactInfo.description } : {}),
    };
    const existing = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, workspaceId),
          eq(contacts.phone, phone),
        ),
      )
      .limit(1);
    const existingRow = existing[0] ?? null;

    if (existingRow) {
      const currentFirstName = existingRow.firstName;
      const currentLastName = existingRow.lastName;
      const existingMetadata =
        existingRow.metadata && typeof existingRow.metadata === "object"
          ? (existingRow.metadata as Record<string, unknown>)
          : {};
      const mergedMetadata = { ...existingMetadata, ...contactMetadata };
      const hasBetterDisplayName = Boolean(displayName?.trim()) && displayName?.trim() !== phone;
      const currentLooksLikePlaceholder =
        currentFirstName === phone ||
        currentFirstName === "WhatsApp" ||
        `${currentFirstName} ${currentLastName}`.trim() === phone;
      if (hasBetterDisplayName && currentLooksLikePlaceholder) {
        await db
          .update(contacts)
          .set({ firstName, lastName, metadata: mergedMetadata })
          .where(
            and(
              eq(contacts.workspaceId, workspaceId),
              eq(contacts.id, existingRow.id),
            ),
          );
        console.info(`[${scope}/findOrCreateContactByPhone] Success: userId=${workspaceId}`);
        return { id: existingRow.id, firstName, lastName };
      }
      if (Object.keys(contactMetadata).length > 1) {
        await db
          .update(contacts)
          .set({ metadata: mergedMetadata })
          .where(
            and(
              eq(contacts.workspaceId, workspaceId),
              eq(contacts.id, existingRow.id),
            ),
          );
      }
      console.info(`[${scope}/findOrCreateContactByPhone] Success: userId=${workspaceId}`);
      return { id: existingRow.id, firstName: currentFirstName, lastName: currentLastName };
    }

    const inserted = await db
      .insert(contacts)
      .values({
        workspaceId,
        firstName,
        lastName,
        phone,
        metadata: contactMetadata,
      })
      .returning({ id: contacts.id });
    console.info(`[${scope}/findOrCreateContactByPhone] Success: userId=${workspaceId}`);
    return { id: inserted[0].id, firstName, lastName };
  } catch (error) {
    console.error(`[${scope}/findOrCreateContactByPhone] Unexpected error: ${String(error)}`);
    return { id: null, firstName: "", lastName: "" };
  }
}

export async function findOrCreateConversation(
  workspaceId: string,
  contactId: string,
  contactDisplayName: string
): Promise<string | null> {
  try {
    const existing = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.contactId, contactId),
        ),
      )
      .limit(1);
    const existingRow = existing[0] ?? null;
    if (existingRow?.id) {
      console.info(`[${scope}/findOrCreateConversation] Success: userId=${workspaceId}`);
      return existingRow.id;
    }

    const created = await db
      .insert(conversations)
      .values({
        workspaceId,
        contactId,
        title: `${contactDisplayName} - WhatsApp`,
        status: "open",
      })
      .returning({ id: conversations.id });
    console.info(`[${scope}/findOrCreateConversation] Success: userId=${workspaceId}`);
    return created[0].id;
  } catch (error) {
    console.error(`[${scope}/findOrCreateConversation] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function findConnectionByPhoneNumber(
  workspaceId: string,
  phoneNumber: string
): Promise<{
  id: string;
  workspace_id: string;
  phone_number: string | null;
  agent_config_id: string | null;
  mode: WhatsappConnectionMode;
  status: string | null;
  last_state_instance: string | null;
}> {
  const fallback = {
    id: "",
    workspace_id: "",
    phone_number: null,
    agent_config_id: null,
    mode: "inactive" as WhatsappConnectionMode,
    status: null,
    last_state_instance: null,
  };
  try {
    const data = await db
      .select()
      .from(whatsappConnections)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.phoneNumber, phoneNumber),
        ),
      )
      .limit(1);
    const row = data[0] ?? null;
    if (!row) {
      console.error(`[${scope}/findConnectionByPhoneNumber] Failed query: Connection not found`);
      return fallback;
    }
    const rawMode = row.mode as string | null | undefined;
    const mode: WhatsappConnectionMode =
      rawMode === "testing" || rawMode === "live" ? rawMode : "inactive";
    console.info(`[${scope}/findConnectionByPhoneNumber] Success: userId=${workspaceId}`);
    return {
      id: row.id,
      workspace_id: row.workspaceId,
      phone_number: row.phoneNumber ?? null,
      agent_config_id: row.agentConfigId ?? null,
      mode,
      status: row.status ?? null,
      last_state_instance: row.lastStateInstance ?? null,
    };
  } catch (error) {
    console.error(`[${scope}/findConnectionByPhoneNumber] Unexpected error: ${String(error)}`);
    return fallback;
  }
}

export async function listConnectionsByAgentConfigId(
  workspaceId: string,
  agentConfigId: string,
): Promise<
  Array<{
    id: string;
    workspace_id: string;
    display_name: string;
    phone_number: string | null;
    mode: WhatsappConnectionMode;
  }>
> {
  const trimmedAgent = agentConfigId.trim();
  if (!trimmedAgent) {
    console.error(`[${scope}/listConnectionsByAgentConfigId] Failed query: agentConfigId is empty`);
    return [];
  }
  try {
    const data = await db
      .select()
      .from(whatsappConnections)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.agentConfigId, trimmedAgent),
        ),
      )
      .orderBy(asc(whatsappConnections.createdAt));
    const rows = data.map((row) => {
      const rawMode = row.mode as string | null | undefined;
      const mode: WhatsappConnectionMode =
        rawMode === "testing" || rawMode === "live" ? rawMode : "inactive";
      return {
        id: row.id,
        workspace_id: row.workspaceId,
        display_name: row.displayName,
        phone_number: row.phoneNumber ?? null,
        mode,
      };
    });
    console.info(`[${scope}/listConnectionsByAgentConfigId] Success: userId=${workspaceId}`);
    return rows;
  } catch (error) {
    console.error(`[${scope}/listConnectionsByAgentConfigId] Unexpected error: ${String(error)}`);
    return [];
  }
}

/** Returns one attached connection if any exist (archive/delete gates). Prefer listConnectionsByAgentConfigId for multi-attach. */
export async function findConnectionByAgentConfigId(
  workspaceId: string,
  agentConfigId: string
): Promise<{
  id: string;
  workspace_id: string;
  mode: WhatsappConnectionMode;
}> {
  const fallback = {
    id: "",
    workspace_id: "",
    mode: "inactive" as WhatsappConnectionMode,
  };
  try {
    const rows = await listConnectionsByAgentConfigId(workspaceId, agentConfigId);
    const row = rows[0] ?? null;
    if (!row) {
      console.error(`[${scope}/findConnectionByAgentConfigId] Failed query: Connection not found`);
      return fallback;
    }
    console.info(`[${scope}/findConnectionByAgentConfigId] Success: userId=${workspaceId}`);
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      mode: row.mode,
    };
  } catch (error) {
    console.error(`[${scope}/findConnectionByAgentConfigId] Unexpected error: ${String(error)}`);
    return fallback;
  }
}

/**
 * Resolves which WhatsApp line a task (or similar agent-initiated send) should use.
 * Prefer an explicit connection id; otherwise only auto-pick when the agent has exactly one attachment.
 */
export async function resolveWhatsappConnectionIdForAgentTask(
  workspaceId: string,
  agentConfigId: string,
  whatsappConnectionId?: string | null,
): Promise<{ ok: true; connectionId: string } | { ok: false; error: string }> {
  const trimmedAgent = agentConfigId.trim();
  if (!trimmedAgent) {
    return { ok: false, error: "Agent id is required." };
  }
  const attached = await listConnectionsByAgentConfigId(workspaceId, trimmedAgent);
  const explicit = whatsappConnectionId?.trim() ?? "";
  if (explicit) {
    const match = attached.find((row) => row.id === explicit);
    if (!match) {
      return {
        ok: false,
        error: "WhatsApp connection is not attached to this agent.",
      };
    }
    return { ok: true, connectionId: match.id };
  }
  if (attached.length === 1) {
    return { ok: true, connectionId: attached[0].id };
  }
  if (attached.length === 0) {
    return { ok: false, error: "No WhatsApp connection attached to this agent." };
  }
  return {
    ok: false,
    error: "WhatsApp connection is required when the agent has multiple connections.",
  };
}

export async function getConversationWhatsappChatId(
  workspaceId: string,
  conversationId: string
): Promise<string | null> {
  try {
    const data = await db
      .select({ whatsappChatId: conversations.whatsappChatId })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      )
      .limit(1);
    const chatId = data[0]?.whatsappChatId ?? null;
    console.info(`[${scope}/getConversationWhatsappChatId] Success: userId=${workspaceId}`);
    return chatId;
  } catch (error) {
    console.error(`[${scope}/getConversationWhatsappChatId] Unexpected error: ${String(error)}`);
    return null;
  }
}

/** Same eligibility as manual send: one fully credentialed authorized row in the workspace (by created_at). */
export function isWhatsappConnectionAuthorized(row: {
  status: string | null;
  last_state_instance?: string | null;
  lastStateInstance?: string | null;
}): boolean {
  const lastState = row.last_state_instance ?? row.lastStateInstance ?? null;
  return row.status === "authorized" || lastState === "authorized";
}

export async function getWorkspaceSendableWhatsappConnectionRow(
  workspaceId: string
): Promise<{
  id: string;
  mode: WhatsappConnectionMode;
} | null> {
  try {
    const data = await db
      .select()
      .from(whatsappConnections)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          or(
            eq(whatsappConnections.status, "authorized"),
            eq(whatsappConnections.lastStateInstance, "authorized"),
          ),
        ),
      )
      .orderBy(asc(whatsappConnections.createdAt))
      .limit(1);
    const row = data[0] ?? null;
    if (!row) {
      console.info(`[${scope}/getWorkspaceSendableWhatsappConnectionRow] Success: no row userId=${workspaceId}`);
      return null;
    }
    const rawMode = row.mode as string | null | undefined;
    const mode: WhatsappConnectionMode =
      rawMode === "testing" || rawMode === "live" ? rawMode : "inactive";
    console.info(`[${scope}/getWorkspaceSendableWhatsappConnectionRow] Success: userId=${workspaceId}`);
    return { id: row.id, mode };
  } catch (error) {
    console.error(
      `[${scope}/getWorkspaceSendableWhatsappConnectionRow] Unexpected error: ${String(error)}`
    );
    return null;
  }
}

export function isWhatsappConnectionRowSendable(row: {
  status: string | null;
  last_state_instance?: string | null;
  lastStateInstance?: string | null;
}): boolean {
  return isWhatsappConnectionAuthorized(row);
}

/** One connection row (any status) for composer / thread scoping. */
export async function getWhatsappConnectionRowById(
  workspaceId: string,
  connectionId: string,
): Promise<{
  id: string;
  mode: WhatsappConnectionMode;
  status: string | null;
  agent_config_id: string | null;
} | null> {
  const trimmedId = connectionId.trim();
  if (!trimmedId) {
    console.info(`[${scope}/getWhatsappConnectionRowById] Success: empty connectionId userId=${workspaceId}`);
    return null;
  }
  try {
    const data = await db
      .select()
      .from(whatsappConnections)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          eq(whatsappConnections.id, trimmedId),
        ),
      )
      .limit(1);
    const row = data[0] ?? null;
    if (!row) {
      console.info(
        `[${scope}/getWhatsappConnectionRowById] Success: no row userId=${workspaceId} connectionId=${trimmedId}`,
      );
      return null;
    }
    const rawMode = row.mode as string | null | undefined;
    const mode: WhatsappConnectionMode =
      rawMode === "testing" || rawMode === "live" ? rawMode : "inactive";
    const rawAgent = row.agentConfigId;
    const agentConfigId =
      rawAgent != null && String(rawAgent).trim().length > 0 ? String(rawAgent).trim() : null;
    console.info(`[${scope}/getWhatsappConnectionRowById] Success: userId=${workspaceId}`);
    return {
      id: row.id,
      mode,
      status: row.status ?? null,
      agent_config_id: agentConfigId,
    };
  } catch (error) {
    console.error(`[${scope}/getWhatsappConnectionRowById] Unexpected error: ${String(error)}`);
    return null;
  }
}

/** Same eligibility as {@link getWorkspaceSendableWhatsappConnectionRow}, scoped to one connection id. */
export async function getSendableWhatsappConnectionRowById(
  workspaceId: string,
  connectionId: string,
): Promise<{
  id: string;
  mode: WhatsappConnectionMode;
} | null> {
  const row = await getWhatsappConnectionRowById(workspaceId, connectionId);
  if (!row) {
    return null;
  }
  if (!isWhatsappConnectionRowSendable(row)) {
    console.error(
      `[${scope}/getSendableWhatsappConnectionRowById] Failed query: connection not authorized connectionId=${row.id}`,
    );
    return null;
  }
  console.info(`[${scope}/getSendableWhatsappConnectionRowById] Success: userId=${workspaceId}`);
  return { id: row.id, mode: row.mode };
}

/** Labels for inbox badges when joining from ids (e.g. message-metadata fallback). */
export async function listWhatsappConnectionSummariesByIds(
  workspaceId: string,
  connectionIds: string[]
): Promise<Map<string, { displayName: string; phoneNumber: string | null }>> {
  const map = new Map<string, { displayName: string; phoneNumber: string | null }>();
  const unique = [...new Set(connectionIds)].filter((id) => id.trim().length > 0);
  if (unique.length === 0) {
    console.info(`[${scope}/listWhatsappConnectionSummariesByIds] Success: userId=${workspaceId} empty`);
    return map;
  }
  try {
    const data = await db
      .select({
        id: whatsappConnections.id,
        displayName: whatsappConnections.displayName,
        phoneNumber: whatsappConnections.phoneNumber,
      })
      .from(whatsappConnections)
      .where(
        and(
          eq(whatsappConnections.workspaceId, workspaceId),
          inArray(whatsappConnections.id, unique),
        ),
      );
    for (const row of data) {
      const name = (row.displayName ?? "").trim();
      const phone = (row.phoneNumber ?? "").trim() || null;
      const displayName =
        name.length > 0 ? name : phone ?? "WhatsApp";
      map.set(row.id, { displayName, phoneNumber: phone && phone.length > 0 ? phone : null });
    }
    console.info(`[${scope}/listWhatsappConnectionSummariesByIds] Success: userId=${workspaceId}`);
    return map;
  } catch (error) {
    console.error(`[${scope}/listWhatsappConnectionSummariesByIds] Unexpected error: ${String(error)}`);
    return map;
  }
}

export async function getManualWhatsappSendTarget(
  workspaceId: string,
  conversationId: string
): Promise<ManualWhatsappSendTarget | null> {
  try {
    const convData = await db
      .select({
        whatsappChatId: conversations.whatsappChatId,
        whatsappConnectionId: conversations.whatsappConnectionId,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
          isNull(conversations.archivedAt),
        ),
      )
      .limit(1);
    const conv = convData[0] ?? null;

    const chatId = conv?.whatsappChatId ?? null;
    if (!chatId) {
      console.error(`[${scope}/getManualWhatsappSendTarget] Failed query: conversation WhatsApp chat id not found`);
      return null;
    }

    const scopedConnectionId =
      typeof conv?.whatsappConnectionId === "string"
        ? conv.whatsappConnectionId.trim()
        : "";

    const row =
      scopedConnectionId.length > 0
        ? await getSendableWhatsappConnectionRowById(workspaceId, scopedConnectionId)
        : await getWorkspaceSendableWhatsappConnectionRow(workspaceId);
    if (!row) {
      console.error(
        scopedConnectionId.length > 0
          ? `[${scope}/getManualWhatsappSendTarget] Failed query: conversation WhatsApp line not connected or missing credentials`
          : `[${scope}/getManualWhatsappSendTarget] Failed query: authorized WhatsApp connection not found`,
      );
      return null;
    }

    console.info(`[${scope}/getManualWhatsappSendTarget] Success: userId=${workspaceId}`);
    return {
      chatId,
      connection: { id: row.id },
    };
  } catch (error) {
    console.error(`[${scope}/getManualWhatsappSendTarget] Unexpected error: ${String(error)}`);
    return null;
  }
}

/** Resolves the authorized WhatsApp connection for agent outbound on a conversation thread. */
export async function resolveWhatsappConnectionForConversationAgentOutbound(
  workspaceId: string,
  conversationId: string,
  agentConfigId: string,
): Promise<{
  id: string;
  mode: WhatsappConnectionMode;
} | null> {
  const trimmedAgent = agentConfigId.trim();
  if (!trimmedAgent) {
    console.error(
      `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Failed query: agentConfigId is empty`,
    );
    return null;
  }
  try {
    const convData = await db
      .select({ whatsappConnectionId: conversations.whatsappConnectionId })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      )
      .limit(1);
    const conv = convData[0] ?? null;

    if (!conv) {
      console.error(
        `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Failed query: conversation not found`,
      );
      return null;
    }

    const scopedId =
      typeof conv.whatsappConnectionId === "string" ? conv.whatsappConnectionId.trim() : "";

    let connectionRowId = scopedId;
    if (!connectionRowId) {
      const attached = await listConnectionsByAgentConfigId(workspaceId, trimmedAgent);
      if (attached.length !== 1) {
        console.error(
          `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Failed query: no unambiguous connection for agent count=${attached.length}`,
        );
        return null;
      }
      connectionRowId = attached[0].id.trim();
    }

    const row = await getWhatsappConnectionRowById(workspaceId, connectionRowId);
    if (!row) {
      console.error(
        `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Failed query: connection row not found`,
      );
      return null;
    }
    const rowAgent = String(row.agent_config_id ?? "").trim();
    if (rowAgent !== trimmedAgent) {
      console.error(
        `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Failed query: conversation WhatsApp line agent does not match run agent`,
      );
      return null;
    }
    if (!isWhatsappConnectionRowSendable(row)) {
      console.error(
        `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Failed query: connection not authorized or missing credentials`,
      );
      return null;
    }
    console.info(
      `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Success: userId=${workspaceId}`,
    );
    return { id: row.id, mode: row.mode };
  } catch (error) {
    console.error(
      `[${scope}/resolveWhatsappConnectionForConversationAgentOutbound] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

const WHATSAPP_CONNECTION_ID_IN_METADATA_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Latest inbound/outbound line on the thread from message metadata (legacy rows). */
async function getLatestWhatsappConnectionIdFromMessageMetadata(
  workspaceId: string,
  conversationId: string,
): Promise<string | null> {
  try {
    const rows = await db
      .select({ metadata: messages.metadata })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(250);

    for (const row of rows) {
      const meta = row.metadata as Record<string, unknown> | null;
      if (!meta || typeof meta !== "object") continue;
      const raw = meta.whatsappConnectionId;
      const idStr = typeof raw === "string" ? raw.trim() : "";
      if (idStr && WHATSAPP_CONNECTION_ID_IN_METADATA_RE.test(idStr)) {
        return idStr;
      }
    }
    return null;
  } catch (error) {
    console.error(
      `[${scope}/getLatestWhatsappConnectionIdFromMessageMetadata] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

async function resolveWhatsappConnectionModeById(
  workspaceId: string,
  connectionId: string,
): Promise<WhatsappConnectionMode | null> {
  const trimmedId = connectionId.trim();
  if (!trimmedId) return null;
  const row = await getWhatsappConnectionRowById(workspaceId, trimmedId);
  return row?.mode ?? null;
}

/**
 * Connection mode for inbound AI gating.
 * Prefers the line that received the message, then the thread row, then recent message metadata.
 */
export async function getWhatsappConnectionModeForInboundAi(
  workspaceId: string,
  conversationId: string,
  agentConfigId: string,
  preferredWhatsappConnectionId?: string,
): Promise<WhatsappConnectionMode> {
  const trimmedAgent = agentConfigId.trim();
  try {
    const preferredId = preferredWhatsappConnectionId?.trim() ?? "";
    if (preferredId.length > 0) {
      const preferredMode = await resolveWhatsappConnectionModeById(workspaceId, preferredId);
      if (preferredMode) {
        console.info(
          `[${scope}/getWhatsappConnectionModeForInboundAi] Success: preferred userId=${workspaceId}`,
        );
        return preferredMode;
      }
    }

    const convData = await db
      .select({ whatsappConnectionId: conversations.whatsappConnectionId })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      )
      .limit(1);
    const conv = convData[0] ?? null;

    const scopedId =
      conv && typeof conv.whatsappConnectionId === "string"
        ? conv.whatsappConnectionId.trim()
        : "";
    if (scopedId.length > 0) {
      const scopedMode = await resolveWhatsappConnectionModeById(workspaceId, scopedId);
      if (scopedMode) {
        console.info(`[${scope}/getWhatsappConnectionModeForInboundAi] Success: scoped userId=${workspaceId}`);
        return scopedMode;
      }
    }

    const metadataConnectionId = await getLatestWhatsappConnectionIdFromMessageMetadata(
      workspaceId,
      conversationId,
    );
    if (metadataConnectionId) {
      const metadataMode = await resolveWhatsappConnectionModeById(
        workspaceId,
        metadataConnectionId,
      );
      if (metadataMode) {
        console.info(
          `[${scope}/getWhatsappConnectionModeForInboundAi] Success: metadata userId=${workspaceId}`,
        );
        return metadataMode;
      }
    }

    if (!trimmedAgent) {
      console.info(`[${scope}/getWhatsappConnectionModeForInboundAi] Success: no agent userId=${workspaceId}`);
      return "inactive";
    }
    const attached = await listConnectionsByAgentConfigId(workspaceId, trimmedAgent);
    if (attached.length === 1) {
      console.info(`[${scope}/getWhatsappConnectionModeForInboundAi] Success: by-agent userId=${workspaceId}`);
      return attached[0].mode;
    }
    console.info(
      `[${scope}/getWhatsappConnectionModeForInboundAi] Success: inactive ambiguous userId=${workspaceId}`,
    );
    return "inactive";
  } catch (error) {
    console.error(`[${scope}/getWhatsappConnectionModeForInboundAi] Unexpected error: ${String(error)}`);
    return "inactive";
  }
}

export async function bindAgentToFirstAvailableAuthorizedConnection(
  workspaceId: string,
  agentId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const existing = await listConnectionsByAgentConfigId(workspaceId, agentId);
    if (existing.length > 0) {
      console.info(
        `[${scope}/bindAgentToFirstAvailableAuthorizedConnection] Success: already attached userId=${workspaceId}`,
      );
      return { ok: true, message: "Agent already attached to WhatsApp connection" };
    }

    const rows = await db
      .select()
      .from(whatsappConnections)
      .where(eq(whatsappConnections.workspaceId, workspaceId))
      .orderBy(asc(whatsappConnections.createdAt));

    const target = rows.find(
      (row) =>
        isWhatsappConnectionAuthorized({
          status: row.status,
          lastStateInstance: row.lastStateInstance,
        }) && !row.agentConfigId,
    );

    if (!target) {
      console.error(
        `[${scope}/bindAgentToFirstAvailableAuthorizedConnection] Failed query: no available authorized connection`,
      );
      return { ok: false, message: "No available authorized WhatsApp connection" };
    }

    return bindAgentToWhatsappConnection(workspaceId, agentId, target.id);
  } catch (error) {
    console.error(
      `[${scope}/bindAgentToFirstAvailableAuthorizedConnection] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Unexpected error" };
  }
}

/** Sync this agent's attachments to exactly `connectionIds` (empty = detach all). Reclaims lines owned by other agents. */
export async function syncAgentWhatsappConnections(
  workspaceId: string,
  agentId: string,
  connectionIds: string[],
): Promise<{ ok: boolean; message: string }> {
  const trimmedAgent = agentId.trim();
  if (!trimmedAgent) {
    console.error(`[${scope}/syncAgentWhatsappConnections] Failed query: agentId is empty`);
    return { ok: false, message: "agent_id_required" };
  }
  const uniqueIds = [
    ...new Set(connectionIds.map((id) => id.trim()).filter((id) => id.length > 0)),
  ];
  try {
    if (uniqueIds.length > 0) {
      await db
        .update(whatsappConnections)
        .set({ agentConfigId: trimmedAgent })
        .where(
          and(
            eq(whatsappConnections.workspaceId, workspaceId),
            inArray(whatsappConnections.id, uniqueIds),
          ),
        );
    }

    const detachConditions = [
      eq(whatsappConnections.workspaceId, workspaceId),
      eq(whatsappConnections.agentConfigId, trimmedAgent),
    ];
    if (uniqueIds.length > 0) {
      detachConditions.push(not(inArray(whatsappConnections.id, uniqueIds)));
    }
    await db
      .update(whatsappConnections)
      .set({ agentConfigId: null })
      .where(and(...detachConditions));

    console.info(`[${scope}/syncAgentWhatsappConnections] Success: userId=${workspaceId}`);
    return {
      ok: true,
      message:
        uniqueIds.length === 0
          ? "Agent detached from WhatsApp connections"
          : "Agent WhatsApp connections synced",
    };
  } catch (error) {
    console.error(`[${scope}/syncAgentWhatsappConnections] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Unexpected error" };
  }
}

export async function bindAgentToWhatsappConnection(
  workspaceId: string,
  agentId: string,
  connectionId: string | null
): Promise<{ ok: boolean; message: string }> {
  return syncAgentWhatsappConnections(
    workspaceId,
    agentId,
    connectionId ? [connectionId] : [],
  );
}

export async function findOrCreateConversationByWhatsappChatId(
  workspaceId: string,
  whatsappConnectionId: string,
  contactId: string | null,
  contactDisplayName: string,
  whatsappChatId: string,
): Promise<string | null> {
  const incomingConnectionId = whatsappConnectionId.trim();
  const chatId = whatsappChatId.trim();
  if (!incomingConnectionId || !chatId) {
    console.error(
      `[${scope}/findOrCreateConversationByWhatsappChatId] Failed query: connectionId or chatId empty`,
    );
    return null;
  }

  try {
    const title = `${contactDisplayName} - WhatsApp`;
    const existing = await db
      .select({
        id: conversations.id,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.whatsappConnectionId, incomingConnectionId),
          eq(conversations.whatsappChatId, chatId),
        ),
      )
      .limit(1);
    const existingRow = existing[0] ?? null;

    if (existingRow?.id) {
      console.info(`[${scope}/findOrCreateConversationByWhatsappChatId] Success: userId=${workspaceId}`);
      return existingRow.id;
    }

    const created = await db
      .insert(conversations)
      .values({
        workspaceId,
        whatsappConnectionId: incomingConnectionId,
        contactId,
        title,
        status: "open",
        whatsappChatId: chatId,
        handlingMode: "ai",
      })
      .returning({ id: conversations.id });
    console.info(`[${scope}/findOrCreateConversationByWhatsappChatId] Success: userId=${workspaceId}`);
    publishRealtime(workspaceId, { type: "conversation.created", conversationId: created[0].id });
    return created[0].id;
  } catch (error) {
    console.error(
      `[${scope}/findOrCreateConversationByWhatsappChatId] Unexpected error: ${String(error)}`
    );
    return null;
  }
}

/** Merges `ai_reasoning` into all outbound rows for one agent tool run (same `agent_run_id` in metadata). */
export async function mergeAiReasoningOntoAgentRunMessages(input: {
  workspaceId: string;
  conversationId: string;
  agentRunId: string;
  aiReasoning: string;
}): Promise<{ ok: boolean }> {
  const { workspaceId, conversationId, agentRunId, aiReasoning } = input;
  try {
    const rows = await db
      .select({ id: messages.id, metadata: messages.metadata })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
          sql`${messages.metadata} @> ${JSON.stringify({ agent_run_id: agentRunId })}`,
        ),
      );

    const matched = rows ?? [];
    if (matched.length === 0) {
      console.info(`[${scope}/mergeAiReasoningOntoAgentRunMessages] Success: userId=${workspaceId} matched=0`);
      return { ok: true };
    }

    const handoffRows: Array<{ id: string; metadata: Record<string, unknown> }> = [];
    let updatedRegularRows = 0;

    for (const row of matched) {
      const existing: Record<string, unknown> =
        row.metadata && typeof row.metadata === "object" ? { ...row.metadata } : {};
      if (existing.thread_event === THREAD_EVENT_HANDOFF_TO_HUMAN) {
        handoffRows.push({ id: row.id, metadata: existing });
        continue;
      }
      const merged = { ...existing, ai_reasoning: aiReasoning };
      await db
        .update(messages)
        .set({ metadata: merged })
        .where(
          and(
            eq(messages.workspaceId, workspaceId),
            eq(messages.conversationId, conversationId),
            eq(messages.id, row.id),
          ),
        );
      updatedRegularRows += 1;
    }

    if (updatedRegularRows === 0 && handoffRows.length > 0) {
      for (const row of handoffRows) {
        const merged = { ...row.metadata, ai_reasoning: aiReasoning };
        await db
          .update(messages)
          .set({ metadata: merged })
          .where(
            and(
              eq(messages.workspaceId, workspaceId),
              eq(messages.conversationId, conversationId),
              eq(messages.id, row.id),
            ),
          );
      }
    }

    const totalUpdated = updatedRegularRows === 0 ? handoffRows.length : updatedRegularRows;
    console.info(
      `[${scope}/mergeAiReasoningOntoAgentRunMessages] Success: userId=${workspaceId} updated=${totalUpdated}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/mergeAiReasoningOntoAgentRunMessages] Unexpected error: ${String(error)}`);
    return { ok: false };
  }
}

function resolveWaMessageId(
  options?: ConversationMessageCreateOptions,
  metadata?: Record<string, unknown>,
): string | null {
  const fromOptions =
    typeof options?.waMessageId === "string" ? options.waMessageId.trim() : "";
  if (fromOptions) return fromOptions;
  if (!metadata) return null;
  for (const key of ["whatsappMessageId", "webhookMessageId", "greenMessageId"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function withNormalizedWhatsappMessageId(
  metadata: Record<string, unknown>,
  waMessageId: string | null,
): Record<string, unknown> {
  if (!waMessageId) return metadata;
  if (metadata.whatsappMessageId === waMessageId) return metadata;
  return { ...metadata, whatsappMessageId: waMessageId };
}

export async function createConversationMessage(
  workspaceId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, unknown>,
  outgoingSenderType?: "ai_agent" | "human" | null,
  options?: ConversationMessageCreateOptions
): Promise<CreateConversationMessageResult> {
  try {
    const createdAt = options?.createdAt ?? null;
    const baseMetadata = metadata ?? {};
    const waMessageId = resolveWaMessageId(options, baseMetadata);
    const normalizedMetadata = withNormalizedWhatsappMessageId(baseMetadata, waMessageId);

    const insertQuery = db.insert(messages).values({
      workspaceId,
      conversationId,
      role,
      content,
      metadata: normalizedMetadata,
      outgoingSenderType: outgoingSenderType ?? null,
      whatsappSenderChatId: options?.sender?.whatsappSenderChatId ?? null,
      whatsappSenderName: options?.sender?.whatsappSenderName ?? null,
      waMessageId,
      createdAt: createdAt ? new Date(createdAt) : undefined,
    });

    const inserted = waMessageId
      ? await insertQuery
          .onConflictDoNothing({
            target: [messages.workspaceId, messages.waMessageId],
            where: sql`${messages.waMessageId} is not null`,
          })
          .returning({ id: messages.id })
      : await insertQuery.returning({ id: messages.id });

    const created = inserted.length > 0;
    if (!created) {
      console.info(
        `[${scope}/createConversationMessage] Success: duplicate skipped workspaceId=${workspaceId} waMessageId=${waMessageId}`
      );
      return { ok: true, created: false };
    }

    const updateTime = createdAt ? new Date(createdAt) : new Date();
    await db
      .update(conversations)
      .set({ updatedAt: updateTime })
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      );
    console.info(`[${scope}/createConversationMessage] Success: userId=${workspaceId}`);
    publishRealtime(workspaceId, { type: "message.created", conversationId });
    return { ok: true, created: true };
  } catch (error) {
    console.error(`[${scope}/createConversationMessage] Unexpected error: ${String(error)}`);
    return { ok: false, created: false };
  }
}

function sanitizeStorageFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadIncomingMediaToStorage(input: {
  workspaceId: string;
  whatsappChatId: string;
  messageId: string;
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
}): Promise<{ ok: boolean; path: string | null; fileSizeBytes: number; error: string | null }> {
  const safeName = sanitizeStorageFileName(input.fileName || "attachment");
  const safeChatId = sanitizeStorageFileName(input.whatsappChatId || "unknown-chat");
  const safeMessageId = sanitizeStorageFileName(input.messageId || crypto.randomUUID());
  const path = `${input.workspaceId}/${safeChatId}/${safeMessageId}/${safeName}`;
  const byteLength = input.data.byteLength;

  const reserved = await reserveWorkspaceStorage(input.workspaceId, "media", byteLength);
  if (!reserved.ok) {
    return { ok: false, path: null, fileSizeBytes: 0, error: reserved.message };
  }

  try {
    const { error } = await storageUpload("whatsapp-media", path, input.data, input.mimeType);
    if (error) {
      await releaseWorkspaceStorage(input.workspaceId, "media", byteLength);
      console.error(`[${scope}/uploadIncomingMediaToStorage] Failed query: ${error}`);
      return { ok: false, path: null, fileSizeBytes: 0, error };
    }
    console.info(`[${scope}/uploadIncomingMediaToStorage] Success: userId=${input.workspaceId}`);
    return { ok: true, path, fileSizeBytes: byteLength, error: null };
  } catch (error) {
    await releaseWorkspaceStorage(input.workspaceId, "media", byteLength);
    console.error(`[${scope}/uploadIncomingMediaToStorage] Unexpected error: ${String(error)}`);
    return { ok: false, path: null, fileSizeBytes: 0, error: "Unexpected error" };
  }
}
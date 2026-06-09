import { eq, and, or, lt, gt, gte, lte, ilike, isNull, isNotNull, inArray, desc, asc } from "drizzle-orm";
import { storageCreateSignedUrl, storageDownload } from "../lib/storage.js";
import { db } from "../db/index.js";
import {
  conversations,
  messages,
  contacts,
  whatsappConnections,
} from "../db/schema/index.js";
import {
  listConversationIdsByLabel,
  listLabelBadgesForConversations,
} from "../repositories/conversation-labels.js";
import {
  getWhatsappConnectionRowById,
  isWhatsappConnectionRowSendable,
  getWorkspaceSendableWhatsappConnectionRow,
  listWhatsappConnectionSummariesByIds,
} from "../repositories/whatsapp.js";
import {
  connectionAiEnabledForComposer,
  normalizeWhatsappConnectionMode,
} from "../lib/inbound-ai-mode.js";
import type {
  ContactEmbed,
  ConversationHandlingMode,
  ConversationHeaderData,
  ConversationMessage,
  ConversationMessageBareForAi,
  ConversationMessageMedia,
  ConversationRow,
  ConversationSummary,
} from "../types/repositories.js";

export type ListConversationsOptions = {
  searchQuery?: string;
  labelId?: string;
  /** When true, only conversations currently in human handling mode (including agent handoff). */
  humanHandlingOnly?: boolean;
  /** When set to a UUID, only conversations tied to this WhatsApp connection row. */
  whatsappConnectionId?: string;
};

const scope = "ConversationsRepository";

const DEFAULT_MESSAGES_PAGE_SIZE = 50;
const MAX_MESSAGES_PAGE_SIZE = 100;

type MessageSelectRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  outgoing_sender_type: "ai_agent" | "human" | null;
  whatsapp_sender_chat_id: string | null;
  whatsapp_sender_name: string | null;
};

function avatarFromMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const url = metadata.avatar_url ?? metadata.avatarUrl;
  return typeof url === "string" && url.length > 0 ? url : null;
}

function contactFromEmbed(raw: ContactEmbed | ContactEmbed[]): ConversationHeaderData["contact"] {
  const c = Array.isArray(raw) ? raw[0] : raw;
  if (!c || typeof c.first_name !== "string") return null;
  return {
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone,
    avatarUrl: avatarFromMetadata(c.metadata),
  };
}

function whatsappConnectionSummaryFromRow(
  row: Pick<ConversationRow, "whatsapp_connection_id" | "whatsapp_connections">,
): ConversationSummary["whatsappConnection"] {
  const connectionId = row.whatsapp_connection_id?.trim() ?? "";
  if (!connectionId) return null;
  const raw = row.whatsapp_connections;
  const embed = Array.isArray(raw) ? raw[0] : raw;
  if (!embed || typeof embed !== "object") {
    return { id: connectionId, displayName: "WhatsApp", phoneNumber: null };
  }
  const name = typeof embed.display_name === "string" ? embed.display_name.trim() : "";
  const phone = typeof embed.phone_number === "string" ? embed.phone_number.trim() : null;
  const displayName =
    name.length > 0 ? name : phone && phone.length > 0 ? phone : "WhatsApp";
  return {
    id: connectionId,
    displayName,
    phoneNumber: phone && phone.length > 0 ? phone : null,
  };
}

function normalizeHandlingMode(raw: string | null | undefined): ConversationHandlingMode {
  return raw === "human" ? "human" : "ai";
}

const WHATSAPP_CONNECTION_ID_IN_METADATA_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** For legacy rows with null `whatsapp_connection_id`, infer line from recent message metadata. */
async function listLatestWhatsappConnectionIdsFromMessageMetadata(
  workspaceId: string,
  conversationIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (conversationIds.length === 0) return out;

  const scanOne = async (conversationId: string): Promise<void> => {
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
          out.set(conversationId, idStr);
          return;
        }
      }
    } catch (error) {
      console.error(
        `[${scope}/listLatestWhatsappConnectionIdsFromMessageMetadata] Unexpected error: ${String(error)}`
      );
    }
  };

  const chunkSize = 12;
  for (let i = 0; i < conversationIds.length; i += chunkSize) {
    const chunk = conversationIds.slice(i, i + chunkSize);
    await Promise.all(chunk.map((cid) => scanOne(cid)));
  }

  console.info(
    `[${scope}/listLatestWhatsappConnectionIdsFromMessageMetadata] Success: userId=${workspaceId} resolved=${out.size}`
  );
  return out;
}

type LatestMessagePreviewRow = {
  content: string;
  created_at: string;
  role: string;
  outgoing_sender_type: "ai_agent" | "human" | null;
  whatsapp_sender_name: string | null;
  whatsapp_sender_chat_id: string | null;
};

function firstTokenForConversationListPreview(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.split(" ")[0] ?? t;
}

function toLatestMessagePreviewRow(raw: {
  conversationId: string;
  content: string;
  createdAt: Date | string;
  role: string;
  outgoingSenderType: string | null;
  whatsappSenderName: string | null;
  whatsappSenderChatId: string | null;
}): LatestMessagePreviewRow & { conversationId: string } {
  return {
    conversationId: raw.conversationId,
    content: raw.content,
    created_at: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
    role: raw.role,
    outgoing_sender_type: (raw.outgoingSenderType as LatestMessagePreviewRow["outgoing_sender_type"]) ?? null,
    whatsapp_sender_name: raw.whatsappSenderName ?? null,
    whatsapp_sender_chat_id: raw.whatsappSenderChatId ?? null,
  };
}

async function listLatestMessagePreviews(
  workspaceId: string,
  conversationIds: string[]
): Promise<Map<string, LatestMessagePreviewRow>> {
  const map = new Map<string, LatestMessagePreviewRow>();
  if (conversationIds.length === 0) return map;
  try {
    const rows = await db
      .select({
        conversationId: messages.conversationId,
        content: messages.content,
        createdAt: messages.createdAt,
        role: messages.role,
        outgoingSenderType: messages.outgoingSenderType,
        whatsappSenderName: messages.whatsappSenderName,
        whatsappSenderChatId: messages.whatsappSenderChatId,
      })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          inArray(messages.conversationId, conversationIds),
        ),
      )
      .orderBy(desc(messages.createdAt));

    for (const row of rows) {
      const preview = toLatestMessagePreviewRow(row);
      const cid = preview.conversationId;
      if (!map.has(cid)) {
        map.set(cid, {
          content: preview.content,
          created_at: preview.created_at,
          role: preview.role,
          outgoing_sender_type: preview.outgoing_sender_type,
          whatsapp_sender_name: preview.whatsapp_sender_name,
          whatsapp_sender_chat_id: preview.whatsapp_sender_chat_id,
        });
      }
    }
    console.info(`[${scope}/listLatestMessagePreviews] Success: userId=${workspaceId}`);
    return map;
  } catch (error) {
    console.error(`[${scope}/listLatestMessagePreviews] Unexpected error: ${String(error)}`);
    return map;
  }
}

type ConversationConnectionState = {
  aiEnabled: boolean | null;
  canSendManualWhatsapp: boolean;
};

async function getConversationConnectionState(
  workspaceId: string,
  conversationId: string
): Promise<ConversationConnectionState> {
  try {
    const rows = await db
      .select({
        whatsappChatId: conversations.whatsappChatId,
        whatsappConnectionId: conversations.whatsappConnectionId,
        isTest: contacts.isTest,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      )
      .limit(1);

    const convRow = rows[0];

    const whatsappChatId = (convRow?.whatsappChatId as string | null) ?? null;
    if (!whatsappChatId || whatsappChatId.trim().length === 0) {
      console.info(
        `[${scope}/getConversationConnectionState] Success: no whatsapp_chat_id conversationId=${conversationId}`
      );
      return { aiEnabled: null, canSendManualWhatsapp: false };
    }

    const scopedConnectionId =
      typeof convRow?.whatsappConnectionId === "string"
        ? convRow.whatsappConnectionId.trim()
        : "";

    const isTestContact = convRow?.isTest === true;

    if (scopedConnectionId.length > 0) {
      const scopedConn = await getWhatsappConnectionRowById(workspaceId, scopedConnectionId);
      if (!scopedConn) {
        console.info(
          `[${scope}/getConversationConnectionState] Success: scoped WhatsApp connection not found conversationId=${conversationId}`
        );
        return { aiEnabled: null, canSendManualWhatsapp: false };
      }
      const aiEnabled = connectionAiEnabledForComposer(
        normalizeWhatsappConnectionMode(scopedConn.mode),
        isTestContact
      );
      const canSendManualWhatsapp = isWhatsappConnectionRowSendable(scopedConn);
      console.info(
        `[${scope}/getConversationConnectionState] Success: userId=${workspaceId} conversationId=${conversationId} scopedConnection`
      );
      return {
        aiEnabled,
        canSendManualWhatsapp,
      };
    }

    const connectionRow = await getWorkspaceSendableWhatsappConnectionRow(workspaceId);
    if (!connectionRow) {
      console.info(
        `[${scope}/getConversationConnectionState] Success: no sendable connection conversationId=${conversationId}`
      );
      return { aiEnabled: null, canSendManualWhatsapp: false };
    }

    const aiEnabled = connectionAiEnabledForComposer(
      normalizeWhatsappConnectionMode(connectionRow.mode),
      isTestContact
    );

    console.info(
      `[${scope}/getConversationConnectionState] Success: userId=${workspaceId} conversationId=${conversationId}`
    );
    return {
      aiEnabled,
      canSendManualWhatsapp: true,
    };
  } catch (error) {
    console.error(`[${scope}/getConversationConnectionState] Unexpected error: ${String(error)}`);
    return { aiEnabled: null, canSendManualWhatsapp: false };
  }
}

async function listConversationIdsBySearch(
  workspaceId: string,
  searchText: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const term = `%${searchText}%`;
  try {
    const [contactRows, messageRows] = await Promise.all([
      db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.workspaceId, workspaceId),
            or(
              ilike(contacts.firstName, term),
              ilike(contacts.lastName, term),
              ilike(contacts.phone, term),
            ),
          ),
        ),
      db
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, workspaceId),
            ilike(messages.content, term),
          ),
        ),
    ]);

    const contactIds = contactRows.map((row) => row.id);
    if (contactIds.length > 0) {
      const convRows = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            inArray(conversations.contactId, contactIds),
          ),
        );
      for (const row of convRows) ids.add(row.id);
    }

    for (const row of messageRows) ids.add(row.conversationId);
    console.info(`[${scope}/listConversationIdsBySearch] Success: userId=${workspaceId}`);
    return ids;
  } catch (error) {
    console.error(`[${scope}/listConversationIdsBySearch] Unexpected error: ${String(error)}`);
    return ids;
  }
}

function intersectSets(a: Set<string>, b: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const id of a) {
    if (b.has(id)) out.add(id);
  }
  return out;
}

function toConversationRow(r: {
  id: string;
  title: string;
  status: string;
  handlingMode: string;
  whatsappChatId: string | null;
  whatsappConnectionId: string | null;
  updatedAt: Date | string;
  contactId: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
  contactMetadata: unknown | null;
  wcDisplayName: string | null;
  wcPhoneNumber: string | null;
}): ConversationRow {
  const contactEmbed: ContactEmbed | null =
    r.contactFirstName != null
      ? {
          first_name: r.contactFirstName,
          last_name: r.contactLastName ?? "",
          phone: r.contactPhone ?? "",
          metadata: (r.contactMetadata as Record<string, unknown>) ?? null,
        }
      : null;

  const wcEmbed: { display_name: string | null; phone_number: string | null } | null =
    r.wcDisplayName != null
      ? {
          display_name: r.wcDisplayName,
          phone_number: r.wcPhoneNumber,
        }
      : null;

  return {
    id: r.id,
    title: r.title,
    status: r.status,
    handling_mode: r.handlingMode,
    whatsapp_chat_id: r.whatsappChatId,
    whatsapp_connection_id: r.whatsappConnectionId,
    whatsapp_connections: wcEmbed as ConversationRow["whatsapp_connections"],
    updated_at: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt ?? ""),
    contact_id: r.contactId,
    contacts: contactEmbed as ConversationRow["contacts"],
  };
}

export async function listConversations(
  workspaceId: string,
  options?: ListConversationsOptions | string
): Promise<ConversationSummary[]> {
  const normalizedOptions: ListConversationsOptions =
    typeof options === "string"
      ? { searchQuery: options }
      : (options ?? {});

  try {
    const conditions: ReturnType<typeof eq>[] = [
      eq(conversations.workspaceId, workspaceId),
      isNull(conversations.archivedAt),
    ];

    if (normalizedOptions.humanHandlingOnly === true) {
      conditions.push(eq(conversations.handlingMode, "human"));
    }

    const connectionIdFilter = normalizedOptions.whatsappConnectionId?.trim() ?? "";
    const connectionUuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (connectionIdFilter.length > 0 && connectionUuidRe.test(connectionIdFilter)) {
      conditions.push(eq(conversations.whatsappConnectionId, connectionIdFilter));
    }

    let idFilter: Set<string> | undefined;
    const labelIdFilter = normalizedOptions.labelId?.trim() ?? "";
    if (labelIdFilter.length > 0) {
      const labelIds = await listConversationIdsByLabel(workspaceId, labelIdFilter);
      if (labelIds.size === 0) {
        console.info(`[${scope}/listConversations] Success: userId=${workspaceId} label=empty`);
        return [];
      }
      idFilter = labelIds;
    }

    const normalizedSearch = normalizedOptions.searchQuery?.trim() ?? "";
    if (normalizedSearch.length > 0) {
      const searchIds = await listConversationIdsBySearch(workspaceId, normalizedSearch);
      if (searchIds.size === 0) {
        console.info(`[${scope}/listConversations] Success: userId=${workspaceId} search=empty`);
        return [];
      }
      idFilter = idFilter ? intersectSets(idFilter, searchIds) : searchIds;
      if (idFilter.size === 0) {
        console.info(`[${scope}/listConversations] Success: userId=${workspaceId} intersect=empty`);
        return [];
      }
    }

    if (idFilter !== undefined) {
      conditions.push(inArray(conversations.id, Array.from(idFilter)));
    }

    const rawRows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        status: conversations.status,
        handlingMode: conversations.handlingMode,
        whatsappChatId: conversations.whatsappChatId,
        whatsappConnectionId: conversations.whatsappConnectionId,
        updatedAt: conversations.updatedAt,
        contactId: conversations.contactId,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactPhone: contacts.phone,
        contactMetadata: contacts.metadata,
        wcDisplayName: whatsappConnections.displayName,
        wcPhoneNumber: whatsappConnections.phoneNumber,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(whatsappConnections, eq(conversations.whatsappConnectionId, whatsappConnections.id))
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt));

    const rows = rawRows.map(toConversationRow);
    const ids = rows.map((r) => r.id);
    const latestMap = await listLatestMessagePreviews(workspaceId, ids);
    const labelsMap = await listLabelBadgesForConversations(workspaceId, ids);
    const idsMissingConnection = rows
      .filter(
        (r) =>
          !(r.whatsapp_connection_id?.trim()) &&
          (r.whatsapp_chat_id?.trim() ?? "").length > 0,
      )
      .map((r) => r.id);
    const fallbackConnByConv = await listLatestWhatsappConnectionIdsFromMessageMetadata(
      workspaceId,
      idsMissingConnection,
    );
    const fallbackConnUnique = [...new Set(fallbackConnByConv.values())];
    const fallbackLabels = await listWhatsappConnectionSummariesByIds(
      workspaceId,
      fallbackConnUnique,
    );
    const result: ConversationSummary[] = rows.map((row) => {
      const lm = latestMap.get(row.id);
      let whatsappConnection = whatsappConnectionSummaryFromRow(row);
      if (!whatsappConnection) {
        const inferredId = fallbackConnByConv.get(row.id);
        if (inferredId) {
          const label = fallbackLabels.get(inferredId);
          whatsappConnection = {
            id: inferredId,
            displayName: label?.displayName ?? "WhatsApp",
            phoneNumber: label?.phoneNumber ?? null,
          };
        }
      }
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        handlingMode: normalizeHandlingMode(row.handling_mode),
        whatsappChatId: row.whatsapp_chat_id ?? null,
        whatsappConnection,
        labels: labelsMap.get(row.id) ?? [],
        updated_at: row.updated_at,
        contact: contactFromEmbed(row.contacts),
        lastMessage: lm
          ? {
              content: lm.content,
              createdAt: lm.created_at,
              isOutbound: lm.role === "assistant",
            }
          : null,
      };
    });
    console.info(`[${scope}/listConversations] Success: userId=${workspaceId}`);
    return result;
  } catch (error) {
    console.error(`[${scope}/listConversations] Unexpected error: ${String(error)}`);
    return [];
  }
}

function toMessageSelectRow(raw: {
  id: string;
  role: string;
  content: string;
  createdAt: Date | string;
  metadata: unknown | null;
  outgoingSenderType: string | null;
  whatsappSenderChatId: string | null;
  whatsappSenderName: string | null;
}): MessageSelectRow {
  return {
    id: raw.id,
    role: raw.role,
    content: raw.content,
    created_at: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
    metadata: (raw.metadata as Record<string, unknown>) ?? null,
    outgoing_sender_type: (raw.outgoingSenderType as MessageSelectRow["outgoing_sender_type"]) ?? null,
    whatsapp_sender_chat_id: raw.whatsappSenderChatId ?? null,
    whatsapp_sender_name: raw.whatsappSenderName ?? null,
  };
}

async function hydrateConversationMessageRows(
  rows: MessageSelectRow[],
): Promise<ConversationMessage[]> {
  const result: ConversationMessage[] = [];

  for (const row of rows) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const rawMedia =
      metadata && typeof metadata.media === "object" && metadata.media !== null
        ? (metadata.media as Record<string, unknown>)
        : null;

    const media: ConversationMessageMedia | null = rawMedia
      ? {
          path: typeof rawMedia.path === "string" ? rawMedia.path : undefined,
          fileName: typeof rawMedia.fileName === "string" ? rawMedia.fileName : undefined,
          mimeType: typeof rawMedia.mimeType === "string" ? rawMedia.mimeType : undefined,
          caption: typeof rawMedia.caption === "string" ? rawMedia.caption : undefined,
          sourceUrl: typeof rawMedia.sourceUrl === "string" ? rawMedia.sourceUrl : undefined,
          thumbnailDataUrl:
            typeof rawMedia.thumbnailDataUrl === "string"
              ? rawMedia.thumbnailDataUrl
              : undefined,
          fileSizeBytes:
            typeof rawMedia.fileSizeBytes === "number"
              ? rawMedia.fileSizeBytes
              : typeof rawMedia.fileSizeBytes === "string"
                ? Number(rawMedia.fileSizeBytes) || undefined
                : undefined,
        }
      : null;

    if (media?.path) {
      const signedUrl = await storageCreateSignedUrl("whatsapp-media", media.path, 60 * 60);
      if (signedUrl) {
        media.signedUrl = signedUrl;
      }
    }

    result.push({
      id: row.id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      metadata,
      outgoing_sender_type: row.outgoing_sender_type,
      whatsapp_sender_chat_id: row.whatsapp_sender_chat_id,
      whatsapp_sender_name: row.whatsapp_sender_name,
      media,
    });
  }

  return result;
}

function clampMessagesPageSize(requested: number): number {
  if (!Number.isFinite(requested) || requested < 1) return DEFAULT_MESSAGES_PAGE_SIZE;
  return Math.min(Math.floor(requested), MAX_MESSAGES_PAGE_SIZE);
}

export type ListConversationMessagesPageResult = {
  messages: ConversationMessage[];
  hasMoreOlderMessages: boolean;
};

export async function listConversationMessagesLatestPage(
  workspaceId: string,
  conversationId: string,
  limit: number,
): Promise<ListConversationMessagesPageResult> {
  const capped = clampMessagesPageSize(limit);
  const fetchSize = capped + 1;
  try {
    const rawRows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
        outgoingSenderType: messages.outgoingSenderType,
        whatsappSenderChatId: messages.whatsappSenderChatId,
        whatsappSenderName: messages.whatsappSenderName,
      })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(fetchSize);

    const rows = rawRows.map(toMessageSelectRow);
    const hasMoreOlderMessages = rows.length > capped;
    const slice = hasMoreOlderMessages ? rows.slice(0, capped) : rows;
    const ascendingRows = [...slice].reverse();
    const result = await hydrateConversationMessageRows(ascendingRows);
    console.info(`[${scope}/listConversationMessagesLatestPage] Success: userId=${workspaceId}`);
    return { messages: result, hasMoreOlderMessages };
  } catch (error) {
    console.error(
      `[${scope}/listConversationMessagesLatestPage] Unexpected error: ${String(error)}`,
    );
    return { messages: [], hasMoreOlderMessages: false };
  }
}

export async function listConversationMessagesOlderPage(
  workspaceId: string,
  conversationId: string,
  limit: number,
  beforeCreatedAt: string,
  beforeId: string,
): Promise<ListConversationMessagesPageResult> {
  const capped = clampMessagesPageSize(limit);
  const fetchSize = capped + 1;
  const beforeDate = new Date(beforeCreatedAt);
  try {
    const rawRows = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
        outgoingSenderType: messages.outgoingSenderType,
        whatsappSenderChatId: messages.whatsappSenderChatId,
        whatsappSenderName: messages.whatsappSenderName,
      })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
          or(
            lt(messages.createdAt, beforeDate),
            and(
              eq(messages.createdAt, beforeDate),
              lt(messages.id, beforeId),
            ),
          ),
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(fetchSize);

    const rows = rawRows.map(toMessageSelectRow);
    const hasMoreOlderMessages = rows.length > capped;
    const slice = hasMoreOlderMessages ? rows.slice(0, capped) : rows;
    const ascendingRows = [...slice].reverse();
    const result = await hydrateConversationMessageRows(ascendingRows);
    console.info(`[${scope}/listConversationMessagesOlderPage] Success: userId=${workspaceId}`);
    return { messages: result, hasMoreOlderMessages };
  } catch (error) {
    console.error(
      `[${scope}/listConversationMessagesOlderPage] Unexpected error: ${String(error)}`,
    );
    return { messages: [], hasMoreOlderMessages: false };
  }
}

export async function listConversationMessagesBareForAi(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationMessageBareForAi[]> {
  try {
    const rawRows = await db
      .select({
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
      })
      .from(messages)
      .where(
        and(
          eq(messages.workspaceId, workspaceId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .orderBy(asc(messages.createdAt));

    const rows: ConversationMessageBareForAi[] = rawRows.map((row) => ({
      role: row.role,
      content: row.content,
      created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      metadata: (row.metadata as Record<string, unknown>) ?? null,
    }));
    console.info(`[${scope}/listConversationMessagesBareForAi] Success: userId=${workspaceId}`);
    return rows;
  } catch (error) {
    console.error(`[${scope}/listConversationMessagesBareForAi] Unexpected error: ${String(error)}`);
    return [];
  }
}


const INBOUND_AI_SIGNED_URL_SECONDS = 60 * 60;

/**
 * Short-lived signed URL for model input (OpenRouter / AI SDK may fetch the URL).
 */
export async function signWhatsappMediaPathForInboundAi(
  workspaceId: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const signedUrl = await storageCreateSignedUrl("whatsapp-media", storagePath, INBOUND_AI_SIGNED_URL_SECONDS);
    if (!signedUrl) {
      console.error(
        `[${scope}/signWhatsappMediaPathForInboundAi] Failed query: missing signedUrl`,
      );
      return null;
    }
    console.info(`[${scope}/signWhatsappMediaPathForInboundAi] Success: userId=${workspaceId}`);
    return signedUrl;
  } catch (error) {
    console.error(`[${scope}/signWhatsappMediaPathForInboundAi] Unexpected error: ${String(error)}`);
    return null;
  }
}

/** Download raw bytes from workspace WhatsApp media storage (service role). */
export async function downloadWhatsappMediaBuffer(
  workspaceId: string,
  storagePath: string,
): Promise<Uint8Array | null> {
  try {
    const buffer = await storageDownload("whatsapp-media", storagePath);
    if (!buffer) {
      console.error(
        `[${scope}/downloadWhatsappMediaBuffer] Failed query: no data`,
      );
      return null;
    }
    console.info(`[${scope}/downloadWhatsappMediaBuffer] Success: userId=${workspaceId}`);
    return buffer;
  } catch (error) {
    console.error(`[${scope}/downloadWhatsappMediaBuffer] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function getConversationWithContact(
  workspaceId: string,
  conversationId: string
): Promise<ConversationHeaderData | null> {
  try {
    const rawRows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        status: conversations.status,
        handlingMode: conversations.handlingMode,
        whatsappChatId: conversations.whatsappChatId,
        whatsappConnectionId: conversations.whatsappConnectionId,
        contactId: conversations.contactId,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactPhone: contacts.phone,
        contactMetadata: contacts.metadata,
        wcDisplayName: whatsappConnections.displayName,
        wcPhoneNumber: whatsappConnections.phoneNumber,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(whatsappConnections, eq(conversations.whatsappConnectionId, whatsappConnections.id))
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
          isNull(conversations.archivedAt),
        ),
      )
      .limit(1);

    if (rawRows.length === 0) {
      console.info(
        `[${scope}/getConversationWithContact] Success: no row workspaceId=${workspaceId} conversationId=${conversationId}`
      );
      return null;
    }

    const raw = rawRows[0];

    const contactEmbed: ContactEmbed | null =
      raw.contactFirstName != null
        ? {
            first_name: raw.contactFirstName,
            last_name: raw.contactLastName ?? "",
            phone: raw.contactPhone ?? "",
            metadata: (raw.contactMetadata as Record<string, unknown>) ?? null,
          }
        : null;

    const wcEmbed: { display_name: string | null; phone_number: string | null } | null =
      raw.wcDisplayName != null
        ? {
            display_name: raw.wcDisplayName,
            phone_number: raw.wcPhoneNumber,
          }
        : null;

    const row: ConversationRow = {
      id: raw.id,
      title: raw.title,
      status: raw.status,
      handling_mode: raw.handlingMode,
      whatsapp_chat_id: raw.whatsappChatId,
      whatsapp_connection_id: raw.whatsappConnectionId,
      whatsapp_connections: wcEmbed as ConversationRow["whatsapp_connections"],
      contact_id: raw.contactId,
      contacts: contactEmbed as ConversationRow["contacts"],
      updated_at: "",
    };

    const [labelsMap, connectionState] = await Promise.all([
      listLabelBadgesForConversations(workspaceId, [conversationId]),
      getConversationConnectionState(workspaceId, conversationId),
    ]);
    const result: ConversationHeaderData = {
      id: row.id,
      title: row.title,
      status: row.status,
      handlingMode: normalizeHandlingMode(row.handling_mode),
      connectionAiEnabled: connectionState.aiEnabled,
      canSendManualWhatsapp: connectionState.canSendManualWhatsapp,
      whatsappChatId: row.whatsapp_chat_id ?? null,
      whatsappConnection: whatsappConnectionSummaryFromRow(row),
      labels: labelsMap.get(conversationId) ?? [],
      contact: contactFromEmbed(row.contacts),
    };
    console.info(
      `[${scope}/getConversationWithContact] Success: userId=${workspaceId} conversationId=${conversationId}`
    );
    return result;
  } catch (error) {
    console.error(`[${scope}/getConversationWithContact] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function getConversationHandlingMode(
  workspaceId: string,
  conversationId: string
): Promise<ConversationHandlingMode | null> {
  try {
    const rows = await db
      .select({ handlingMode: conversations.handlingMode })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      console.info(
        `[${scope}/getConversationHandlingMode] Success: no row workspaceId=${workspaceId} conversationId=${conversationId}`
      );
      return null;
    }
    const mode = normalizeHandlingMode(rows[0].handlingMode);
    console.info(
      `[${scope}/getConversationHandlingMode] Success: userId=${workspaceId} conversationId=${conversationId}`
    );
    return mode;
  } catch (error) {
    console.error(`[${scope}/getConversationHandlingMode] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function updateConversationHandlingMode(
  workspaceId: string,
  conversationId: string,
  mode: ConversationHandlingMode
): Promise<{ ok: boolean }> {
  try {
    await db
      .update(conversations)
      .set({ handlingMode: mode, updatedAt: new Date() })
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      );

    console.info(
      `[${scope}/updateConversationHandlingMode] Success: userId=${workspaceId} conversationId=${conversationId} mode=${mode}`
    );
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/updateConversationHandlingMode] Unexpected error: ${String(error)}`);
    return { ok: false };
  }
}

export async function deleteConversation(
  workspaceId: string,
  conversationId: string
): Promise<{ ok: boolean; deleted: boolean }> {
  try {
    const deleted = await db
      .delete(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          eq(conversations.id, conversationId),
        ),
      )
      .returning({ id: conversations.id });

    const wasDeleted = deleted.length > 0;
    if (!wasDeleted) {
      console.info(
        `[${scope}/deleteConversation] Success: no row workspaceId=${workspaceId} conversationId=${conversationId}`
      );
      return { ok: true, deleted: false };
    }
    console.info(
      `[${scope}/deleteConversation] Success: userId=${workspaceId} conversationId=${conversationId}`
    );
    return { ok: true, deleted: true };
  } catch (error) {
    console.error(`[${scope}/deleteConversation] Unexpected error: ${String(error)}`);
    return { ok: false, deleted: false };
  }
}
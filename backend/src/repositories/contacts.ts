import { eq, or, and, inArray, ilike, isNotNull, ne, sql, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentMessages,
  agentSessions,
  contacts,
  conversations,
  leads,
  tasks,
} from "../db/schema/index.js";
import { listPageOffset } from "../lib/pagination.js";
import type { ContactInput, PaginatedResult, TaskFormContactOption } from "../types/repositories.js";

const scope = "ContactsRepository";

const STORED_CONTACT_SELECT = {
  id: contacts.id,
  firstName: contacts.firstName,
  lastName: contacts.lastName,
  phone: contacts.phone,
  metadata: contacts.metadata,
  createdAt: contacts.createdAt,
} as const;

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_test: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ContactListRow = ContactRow & {
  has_conversation: boolean;
  has_task: boolean;
};

export type ListContactsPageOptions = {
  page: number;
  pageSize: number;
  search?: string;
  hasMetadataOnly?: boolean;
  testOnly?: boolean;
};

export type ListContactOptionsParams = {
  search?: string;
  limit?: number;
};

const DEFAULT_CONTACT_OPTIONS_LIMIT = 100;
const MAX_CONTACT_OPTIONS_LIMIT = 200;

function toIlikePattern(term: string): string {
  const escaped = term.replace(/[%_\\]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}

async function enrichContactFlags(
  workspaceId: string,
  contactIds: string[],
): Promise<{ contactedIds: Set<string>; taskContactIds: Set<string> }> {
  let contactedIds = new Set<string>();
  let taskContactIds = new Set<string>();
  if (contactIds.length === 0) {
    return { contactedIds, taskContactIds };
  }

  try {
    const conversationRows = await db
      .select({ contactId: conversations.contactId })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, workspaceId),
          inArray(conversations.contactId, contactIds),
        ),
      );
    contactedIds = new Set(
      conversationRows.map((r) => r.contactId).filter((c): c is string => typeof c === "string"),
    );
  } catch (conversationsError) {
    console.error(
      `[${scope}/enrichContactFlags] Failed query: ${String(conversationsError)}`,
    );
  }

  try {
    const leadRows = await db
      .select({ id: leads.id, contactId: leads.contactId })
      .from(leads)
      .where(
        and(
          eq(leads.workspaceId, workspaceId),
          inArray(leads.contactId, contactIds),
        ),
      );

    const leadIdToContactId = new Map<string, string>();
    for (const lead of leadRows) {
      leadIdToContactId.set(lead.id, lead.contactId);
    }
    const leadIds = leadRows.map((lead) => lead.id);
    if (leadIds.length > 0) {
      try {
        const taskRows = await db
          .select({ leadId: tasks.leadId })
          .from(tasks)
          .where(
            and(
              eq(tasks.workspaceId, workspaceId),
              inArray(tasks.leadId, leadIds),
            ),
          );
        for (const task of taskRows) {
          if (!task.leadId) continue;
          const contactId = leadIdToContactId.get(task.leadId);
          if (contactId) {
            taskContactIds.add(contactId);
          }
        }
      } catch (tasksError) {
        console.error(
          `[${scope}/enrichContactFlags] Failed query: ${String(tasksError)}`,
        );
      }
    }
  } catch (leadsError) {
    console.error(
      `[${scope}/enrichContactFlags] Failed query: ${String(leadsError)}`,
    );
  }

  return { contactedIds, taskContactIds };
}

export async function listContactsPage(
  workspaceId: string,
  options: ListContactsPageOptions,
): Promise<PaginatedResult<ContactListRow>> {
  const { page, pageSize } = options;
  const offset = listPageOffset(page, pageSize);

  try {
    const search = options.search?.trim() ?? "";
    const searchPattern = search.length > 0 ? toIlikePattern(search) : "";

    const conditions: (ReturnType<typeof eq> | ReturnType<typeof and>)[] = [
      eq(contacts.workspaceId, workspaceId),
    ];

    if (options.testOnly === true) {
      conditions.push(eq(sql<boolean>`contacts.is_test`, true));
    }

    if (searchPattern.length > 0) {
      conditions.push(
        or(
          ilike(contacts.firstName, searchPattern),
          ilike(contacts.lastName, searchPattern),
          ilike(contacts.phone, searchPattern),
        ),
      );
    }

    if (options.hasMetadataOnly === true) {
      conditions.push(
        isNotNull(sql`${contacts.metadata}->>'note'`),
        ne(sql`${contacts.metadata}->>'note'`, ""),
      );
    }

    const whereClause = and(...conditions);

    const [countResult, pageRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(contacts)
        .where(whereClause),
      db
        .select({
          ...STORED_CONTACT_SELECT,
          isTest: sql<boolean>`contacts.is_test`,
        })
        .from(contacts)
        .where(whereClause)
        .orderBy(desc(contacts.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const count = countResult[0]?.count ?? 0;

    const contactRows: ContactRow[] = pageRows.map((row) => ({
      id: row.id,
      first_name: row.firstName,
      last_name: row.lastName,
      phone: row.phone,
      is_test: row.isTest as boolean,
      metadata: row.metadata as Record<string, unknown> | null,
      created_at: row.createdAt as unknown as string,
    }));

    const contactIds = contactRows.map((contact) => contact.id);
    const { contactedIds, taskContactIds } = await enrichContactFlags(
      workspaceId,
      contactIds,
    );

    const items: ContactListRow[] = contactRows.map((contact) => ({
      ...contact,
      has_conversation: contactedIds.has(contact.id),
      has_task: taskContactIds.has(contact.id),
    }));

    console.info(`[${scope}/listContactsPage] Success: userId=${workspaceId}`);
    return {
      items,
      total: count,
      page,
      pageSize,
    };
  } catch (error) {
    console.error(`[${scope}/listContactsPage] Unexpected error: ${String(error)}`);
    return { items: [], total: 0, page, pageSize };
  }
}

export async function listContactOptions(
  workspaceId: string,
  params: ListContactOptionsParams = {},
): Promise<TaskFormContactOption[]> {
  const search = params.search?.trim() ?? "";
  const requestedLimit = params.limit ?? DEFAULT_CONTACT_OPTIONS_LIMIT;
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit >= 1
      ? Math.min(Math.floor(requestedLimit), MAX_CONTACT_OPTIONS_LIMIT)
      : DEFAULT_CONTACT_OPTIONS_LIMIT;

  try {
    const conditions: (ReturnType<typeof eq> | ReturnType<typeof and>)[] = [
      eq(contacts.workspaceId, workspaceId),
    ];

    if (search.length > 0) {
      const pattern = toIlikePattern(search);
      conditions.push(
        or(
          ilike(contacts.firstName, pattern),
          ilike(contacts.lastName, pattern),
          ilike(contacts.phone, pattern),
        ),
      );
    }

    const rows = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phone,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.createdAt))
      .limit(limit);

    const result: TaskFormContactOption[] = rows.map((contact) => ({
      id: contact.id,
      label: `${contact.firstName} ${contact.lastName} (${contact.phone})`.trim(),
    }));

    console.info(`[${scope}/listContactOptions] Success: userId=${workspaceId}`);
    return result;
  } catch (error) {
    console.error(`[${scope}/listContactOptions] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function createContact(payload: ContactInput): Promise<{ ok: boolean; message: string }> {
  try {
    await db.insert(contacts).values({
      workspaceId: payload.workspace_id,
      firstName: payload.first_name,
      lastName: payload.last_name,
      phone: payload.phone,
      metadata: payload.metadata,
    });
    console.info(`[${scope}/createContact] Success: userId=${payload.workspace_id}`);
    return { ok: true, message: "Contact added" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createContact] Failed query: ${message}`);
    return { ok: false, message };
  }
}

export async function createContactsBulk(payload: ContactInput[]): Promise<{ ok: boolean; message: string }> {
  try {
    await db.insert(contacts).values(
      payload.map((p) => ({
        workspaceId: p.workspace_id,
        firstName: p.first_name,
        lastName: p.last_name,
        phone: p.phone,
        metadata: p.metadata,
      })),
    );
    console.info(
      `[${scope}/createContactsBulk] Success: userId=${payload[0]?.workspace_id ?? "unknown"}`,
    );
    return { ok: true, message: `Imported ${payload.length} contacts` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createContactsBulk] Failed query: ${message}`);
    return { ok: false, message };
  }
}

export async function updateContactIsTest(
  workspaceId: string,
  contactId: string,
  isTest: boolean,
): Promise<{ ok: boolean; message: string }> {
  try {
    await db.execute(
      sql`UPDATE contacts SET is_test = ${isTest} WHERE id = ${contactId} AND workspace_id = ${workspaceId}`,
    );
    console.info(
      `[${scope}/updateContactIsTest] Success: userId=${workspaceId} contactId=${contactId} isTest=${isTest}`,
    );
    return { ok: true, message: "Contact updated" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/updateContactIsTest] Failed query: ${message}`);
    return { ok: false, message };
  }
}

function whatsappChatIdCandidatesForContact(
  phone: string,
  metadata: Record<string, unknown> | null,
): string[] {
  const digits = phone.replace(/\D/g, "");
  const candidates = new Set<string>();
  const metaChatId = metadata?.whatsapp_chat_id;
  if (typeof metaChatId === "string" && metaChatId.trim()) {
    candidates.add(metaChatId.trim());
  }
  if (digits.length > 0) {
    candidates.add(`${digits}@s.whatsapp.net`);
    candidates.add(`${digits}@lid`);
  }
  return [...candidates];
}

export async function deleteContactWithConversationData(
  workspaceId: string,
  contactId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const contactRows = await db
      .select({
        id: contacts.id,
        phone: contacts.phone,
        metadata: contacts.metadata,
      })
      .from(contacts)
      .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.id, contactId)))
      .limit(1);

    const contact = contactRows[0] ?? null;
    if (!contact) {
      console.info(
        `[${scope}/deleteContactWithConversationData] Success: no row workspaceId=${workspaceId} contactId=${contactId}`,
      );
      return { ok: false, message: "Contact not found" };
    }

    const metadata =
      contact.metadata && typeof contact.metadata === "object"
        ? (contact.metadata as Record<string, unknown>)
        : null;
    const chatIdCandidates = whatsappChatIdCandidatesForContact(contact.phone, metadata);
    const phoneDigits = contact.phone.replace(/\D/g, "");

    const conversationConditions = [
      eq(conversations.contactId, contactId),
      ...(chatIdCandidates.length > 0
        ? [inArray(conversations.whatsappChatId, chatIdCandidates)]
        : []),
      ...(phoneDigits.length > 0
        ? [ilike(conversations.whatsappChatId, `${phoneDigits}@%`)]
        : []),
    ];

    const conversationRows = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(eq(conversations.workspaceId, workspaceId), or(...conversationConditions)),
      );

    const conversationIds = [
      ...new Set(conversationRows.map((row) => row.id).filter((id): id is string => Boolean(id))),
    ];

    if (conversationIds.length > 0) {
      await db
        .delete(agentMessages)
        .where(
          and(
            eq(agentMessages.workspaceId, workspaceId),
            inArray(agentMessages.agentSessionId, conversationIds),
          ),
        );
      await db
        .delete(agentSessions)
        .where(
          and(
            eq(agentSessions.workspaceId, workspaceId),
            inArray(agentSessions.id, conversationIds),
          ),
        );
      await db
        .delete(conversations)
        .where(
          and(
            eq(conversations.workspaceId, workspaceId),
            inArray(conversations.id, conversationIds),
          ),
        );
    }

    const deleted = await db
      .delete(contacts)
      .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.id, contactId)))
      .returning({ id: contacts.id });

    if (deleted.length === 0) {
      console.error(
        `[${scope}/deleteContactWithConversationData] Failed query: contact row not deleted workspaceId=${workspaceId} contactId=${contactId}`,
      );
      return { ok: false, message: "Contact not found" };
    }

    console.info(
      `[${scope}/deleteContactWithConversationData] Success: userId=${workspaceId} contactId=${contactId} conversationsRemoved=${conversationIds.length}`,
    );
    return { ok: true, message: "Contact deleted" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/deleteContactWithConversationData] Unexpected error: ${message}`);
    return { ok: false, message };
  }
}

export async function getContactIsTestForConversation(
  workspaceId: string,
  conversationId: string,
): Promise<boolean> {
  try {
    const rows = await db
      .select({
        isTest: sql<boolean>`contacts.is_test`,
      })
      .from(conversations)
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(
        and(eq(conversations.workspaceId, workspaceId), eq(conversations.id, conversationId)),
      )
      .limit(1);

    const row = rows[0] ?? null;
    if (!row) {
      console.info(
        `[${scope}/getContactIsTestForConversation] Success: no row workspaceId=${workspaceId} conversationId=${conversationId}`,
      );
      return false;
    }
    const isTest = row.isTest === true;
    console.info(`[${scope}/getContactIsTestForConversation] Success: userId=${workspaceId}`);
    return isTest;
  } catch (error) {
    console.error(
      `[${scope}/getContactIsTestForConversation] Unexpected error: ${String(error)}`,
    );
    return false;
  }
}
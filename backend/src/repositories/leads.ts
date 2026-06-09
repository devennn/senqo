import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { contacts, conversations, leads } from "../db/schema/index.js";
import type { LeadContactRow, LeadRecord, LeadStatus } from "../types/repositories.js";

const scope = "LeadsRepository";

const LEAD_SELECT = {
  id: leads.id,
  workspaceId: leads.workspaceId,
  contactId: leads.contactId,
  status: leads.status,
  source: leads.source,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
};

function toLeadRecord(row: typeof LEAD_SELECT extends Record<string, infer C> ? { [K in keyof typeof LEAD_SELECT]: unknown } : never): LeadRecord {
  return {
    id: String(row.id as string),
    workspace_id: String(row.workspaceId as string),
    contact_id: String(row.contactId as string),
    status: (row.status as string) as LeadStatus,
    source: (row.source as string) as LeadRecord["source"],
    created_at: row.createdAt as unknown as string,
    updated_at: row.updatedAt as unknown as string,
  };
}

export async function findOrCreateLeadForContact(
  workspaceId: string,
  contactId: string,
): Promise<LeadRecord | null> {
  try {
    const contactRows = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.id, contactId)))
      .limit(1);

    const contact = contactRows[0] ?? null;

    if (!contact?.id) {
      console.error(`[${scope}/findOrCreateLeadForContact] Failed query: contact not found`);
      return null;
    }

    const existingRows = await db
      .select(LEAD_SELECT)
      .from(leads)
      .where(and(eq(leads.workspaceId, workspaceId), eq(leads.contactId, contactId)))
      .limit(1);

    const existingLead = existingRows[0] ?? null;

    if (existingLead) {
      console.info(`[${scope}/findOrCreateLeadForContact] Success: userId=${workspaceId}`);
      return toLeadRecord(existingLead as unknown as Parameters<typeof toLeadRecord>[0]);
    }

    const createdRows = await db
      .insert(leads)
      .values({
        workspaceId,
        contactId,
        status: "new",
        source: "manual",
      })
      .returning(LEAD_SELECT);

    const createdLead = createdRows[0] ?? null;

    if (!createdLead) {
      console.error(`[${scope}/findOrCreateLeadForContact] Failed query: insert returned no row`);
      return null;
    }

    console.info(`[${scope}/findOrCreateLeadForContact] Success: userId=${workspaceId}`);
    return toLeadRecord(createdLead as unknown as Parameters<typeof toLeadRecord>[0]);
  } catch (error) {
    console.error(`[${scope}/findOrCreateLeadForContact] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function findOrCreateLeadForConversation(
  workspaceId: string,
  conversationId: string,
): Promise<LeadRecord | null> {
  try {
    const conversationRows = await db
      .select({ contactId: conversations.contactId })
      .from(conversations)
      .where(
        and(eq(conversations.workspaceId, workspaceId), eq(conversations.id, conversationId)),
      )
      .limit(1);

    const conversation = conversationRows[0] ?? null;

    const contactId = conversation?.contactId ?? null;
    if (!contactId) {
      console.error(
        `[${scope}/findOrCreateLeadForConversation] Failed query: contact not found`,
      );
      return null;
    }

    const existingRows = await db
      .select(LEAD_SELECT)
      .from(leads)
      .where(and(eq(leads.workspaceId, workspaceId), eq(leads.contactId, contactId)))
      .limit(1);

    const existingLead = existingRows[0] ?? null;

    if (existingLead) {
      console.info(`[${scope}/findOrCreateLeadForConversation] Success: userId=${workspaceId}`);
      return toLeadRecord(existingLead as unknown as Parameters<typeof toLeadRecord>[0]);
    }

    const createdRows = await db
      .insert(leads)
      .values({
        workspaceId,
        contactId,
        status: "new",
        source: "ai",
      })
      .returning(LEAD_SELECT);

    const createdLead = createdRows[0] ?? null;

    if (!createdLead) {
      console.error(
        `[${scope}/findOrCreateLeadForConversation] Failed query: insert returned no row`,
      );
      return null;
    }

    console.info(`[${scope}/findOrCreateLeadForConversation] Success: userId=${workspaceId}`);
    return toLeadRecord(createdLead as unknown as Parameters<typeof toLeadRecord>[0]);
  } catch (error) {
    console.error(
      `[${scope}/findOrCreateLeadForConversation] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export async function getLeadContactForWorkspace(
  workspaceId: string,
  leadId: string,
): Promise<LeadContactRow | null> {
  try {
    const leadRows = await db
      .select({ contactId: leads.contactId })
      .from(leads)
      .where(and(eq(leads.workspaceId, workspaceId), eq(leads.id, leadId)))
      .limit(1);

    const lead = leadRows[0] ?? null;

    const contactId = lead?.contactId ?? null;
    if (!contactId) {
      console.error(`[${scope}/getLeadContactForWorkspace] Failed query: lead not found`);
      return null;
    }

    const contactRows = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phone,
      })
      .from(contacts)
      .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.id, contactId)))
      .limit(1);

    const contact = contactRows[0] ?? null;

    if (!contact?.phone) {
      console.error(`[${scope}/getLeadContactForWorkspace] Failed query: contact not found`);
      return null;
    }

    console.info(`[${scope}/getLeadContactForWorkspace] Success: userId=${workspaceId}`);
    return {
      contactId: String(contact.id),
      firstName: String(contact.firstName ?? ""),
      lastName: String(contact.lastName ?? ""),
      phone: String(contact.phone),
    };
  } catch (error) {
    console.error(`[${scope}/getLeadContactForWorkspace] Unexpected error: ${String(error)}`);
    return null;
  }
}

/** Oldest `new` leads whose contact has a non-empty phone, capped at `limit`. */
export async function listLeadsForColdOutreach(
  workspaceId: string,
  limit: number,
): Promise<string[]> {
  const fetchCap = Math.min(Math.max(limit * 15, limit), 300);

  try {
    const rows = await db
      .select({
        id: leads.id,
        phone: contacts.phone,
      })
      .from(leads)
      .innerJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.workspaceId, workspaceId), eq(leads.status, "new")))
      .orderBy(asc(leads.createdAt))
      .limit(fetchCap);

    const ids: string[] = [];
    for (const row of rows) {
      if (!row.phone || String(row.phone).trim().length === 0) {
        continue;
      }
      ids.push(String(row.id));
      if (ids.length >= limit) {
        break;
      }
    }

    console.info(`[${scope}/listLeadsForColdOutreach] Success: userId=${workspaceId}`);
    return ids;
  } catch (error) {
    console.error(`[${scope}/listLeadsForColdOutreach] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function updateLeadStatus(
  workspaceId: string,
  leadId: string,
  status: LeadStatus,
): Promise<boolean> {
  try {
    await db
      .update(leads)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(leads.workspaceId, workspaceId), eq(leads.id, leadId)));

    console.info(`[${scope}/updateLeadStatus] Success: userId=${workspaceId} leadId=${leadId}`);
    return true;
  } catch (error) {
    console.error(`[${scope}/updateLeadStatus] Unexpected error: ${String(error)}`);
    return false;
  }
}
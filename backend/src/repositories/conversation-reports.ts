import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentConfigs,
  contacts,
  conversationReports,
  conversations,
  profiles,
  users,
  whatsappConnections,
} from "../db/schema/index.js";
import type {
  ConversationReportEntry,
  ConversationReportRow,
  ConversationReportsPage,
} from "../types/reports.js";

const scope = "ConversationReportsRepository";

function formatPersonName(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string {
  const name = [firstName, lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  if (name.length > 0) return name;
  const trimmedEmail = email?.trim();
  return trimmedEmail && trimmedEmail.length > 0 ? trimmedEmail : "Unknown";
}

function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

async function resolveReporterName(userId: string): Promise<string> {
  const rows = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: users.email,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.id, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return "Unknown";
  return formatPersonName(row.firstName, row.lastName, row.email);
}

export async function createConversationReport(input: {
  workspaceId: string;
  conversationId: string;
  reportedByUserId: string;
  reason: string;
}): Promise<
  { ok: true; report: ConversationReportEntry } | { ok: false; message: string }
> {
  try {
    const conversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.workspaceId, input.workspaceId),
          eq(conversations.id, input.conversationId),
        ),
      )
      .limit(1);
    if (conversation.length === 0) {
      console.info(
        `[${scope}/createConversationReport] Failed query: conversation not found workspaceId=${input.workspaceId} conversationId=${input.conversationId}`,
      );
      return { ok: false, message: "conversation_not_found" };
    }

    const inserted = await db
      .insert(conversationReports)
      .values({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        reportedByUserId: input.reportedByUserId,
        reason: input.reason,
      })
      .returning({
        id: conversationReports.id,
        reason: conversationReports.reason,
        createdAt: conversationReports.createdAt,
      });
    const row = inserted[0];
    if (!row) {
      console.error(
        `[${scope}/createConversationReport] Failed query: insert returned no row conversationId=${input.conversationId}`,
      );
      return { ok: false, message: "conversation_report_insert_failed" };
    }

    const reporterName = await resolveReporterName(input.reportedByUserId);
    console.info(
      `[${scope}/createConversationReport] Success: workspaceId=${input.workspaceId} conversationId=${input.conversationId}`,
    );
    return {
      ok: true,
      report: {
        id: row.id,
        reason: row.reason,
        reportedByName: reporterName,
        createdAt: toIso(row.createdAt),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/createConversationReport] Unexpected error: ${message}`);
    return { ok: false, message };
  }
}

export async function listConversationReportsForConversation(
  workspaceId: string,
  conversationId: string,
  limit = 50,
): Promise<ConversationReportEntry[]> {
  try {
    const rows = await db
      .select({
        id: conversationReports.id,
        reason: conversationReports.reason,
        createdAt: conversationReports.createdAt,
        reporterFirstName: profiles.firstName,
        reporterLastName: profiles.lastName,
        reporterEmail: users.email,
      })
      .from(conversationReports)
      .leftJoin(users, eq(users.id, conversationReports.reportedByUserId))
      .leftJoin(profiles, eq(profiles.id, conversationReports.reportedByUserId))
      .where(
        and(
          eq(conversationReports.workspaceId, workspaceId),
          eq(conversationReports.conversationId, conversationId),
        ),
      )
      .orderBy(desc(conversationReports.createdAt), desc(conversationReports.id))
      .limit(Math.max(1, Math.min(limit, 200)));

    const reports: ConversationReportEntry[] = rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      reportedByName: formatPersonName(
        row.reporterFirstName,
        row.reporterLastName,
        row.reporterEmail,
      ),
      createdAt: toIso(row.createdAt),
    }));
    console.info(
      `[${scope}/listConversationReportsForConversation] Success: workspaceId=${workspaceId} conversationId=${conversationId} count=${reports.length}`,
    );
    return reports;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/listConversationReportsForConversation] Unexpected error: ${message}`);
    return [];
  }
}

export async function listConversationReportsForWorkspace(
  workspaceId: string,
  input: {
    fromDate: Date;
    toDate: Date;
    agentId?: string | null;
    limit: number;
    offset: number;
  },
): Promise<ConversationReportsPage> {
  try {
    const filters = [
      eq(conversationReports.workspaceId, workspaceId),
      gte(conversationReports.createdAt, input.fromDate),
      lte(conversationReports.createdAt, input.toDate),
    ];
    if (input.agentId) {
      filters.push(eq(agentConfigs.id, input.agentId));
    }

    const rows = await db
      .select({
        id: conversationReports.id,
        conversationId: conversationReports.conversationId,
        conversationName: conversations.title,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        reason: conversationReports.reason,
        reporterFirstName: profiles.firstName,
        reporterLastName: profiles.lastName,
        reporterEmail: users.email,
        agentId: whatsappConnections.agentConfigId,
        agentName: agentConfigs.profileName,
        createdAt: conversationReports.createdAt,
      })
      .from(conversationReports)
      .innerJoin(conversations, eq(conversationReports.conversationId, conversations.id))
      .leftJoin(contacts, eq(conversations.contactId, contacts.id))
      .leftJoin(users, eq(users.id, conversationReports.reportedByUserId))
      .leftJoin(profiles, eq(profiles.id, conversationReports.reportedByUserId))
      .leftJoin(
        whatsappConnections,
        eq(conversations.whatsappConnectionId, whatsappConnections.id),
      )
      .leftJoin(agentConfigs, eq(whatsappConnections.agentConfigId, agentConfigs.id))
      .where(and(...filters))
      .orderBy(desc(conversationReports.createdAt), desc(conversationReports.id))
      .limit(Math.max(1, Math.min(input.limit, 100)))
      .offset(Math.max(0, input.offset));

    const totalRows = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(conversationReports)
      .innerJoin(conversations, eq(conversationReports.conversationId, conversations.id))
      .leftJoin(
        whatsappConnections,
        eq(conversations.whatsappConnectionId, whatsappConnections.id),
      )
      .leftJoin(agentConfigs, eq(whatsappConnections.agentConfigId, agentConfigs.id))
      .where(and(...filters));

    const reports: ConversationReportRow[] = rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      conversationName: row.conversationName,
      contactName:
        row.contactFirstName || row.contactLastName
          ? [row.contactFirstName, row.contactLastName]
              .map((part) => part?.trim() ?? "")
              .filter(Boolean)
              .join(" ")
              .trim()
          : null,
      reason: row.reason,
      reportedByName: formatPersonName(
        row.reporterFirstName,
        row.reporterLastName,
        row.reporterEmail,
      ),
      agentId: row.agentId ?? null,
      agentName: row.agentName ?? null,
      createdAt: toIso(row.createdAt),
    }));

    const total = Number(totalRows[0]?.total) || 0;
    console.info(
      `[${scope}/listConversationReportsForWorkspace] Success: workspaceId=${workspaceId} count=${reports.length} total=${total}`,
    );
    return { reports, total };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${scope}/listConversationReportsForWorkspace] Unexpected error: ${message}`);
    return { reports: [], total: 0 };
  }
}
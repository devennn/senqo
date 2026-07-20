import { and, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../db/index.js";
import {
  workspaceHandoffPhones,
  workspaceHandoffPhoneVerifications,
} from "../db/schema/index.js";
import type { WorkspaceHandoffPhoneRecord } from "../types/repositories.js";

const scope = "HandoffPhonesRepository";

export function hashHandoffPhoneCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

function mapPhoneRow(row: {
  workspaceId: string;
  userId: string;
  whatsappConnectionId: string;
  phone: string;
  status: string;
  verifiedAt: Date | null;
}): WorkspaceHandoffPhoneRecord {
  return {
    workspaceId: row.workspaceId,
    userId: row.userId,
    whatsappConnectionId: row.whatsappConnectionId,
    phone: row.phone,
    status: row.status === "verified" ? "verified" : "pending",
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  };
}

const phoneSelect = {
  workspaceId: workspaceHandoffPhones.workspaceId,
  userId: workspaceHandoffPhones.userId,
  whatsappConnectionId: workspaceHandoffPhones.whatsappConnectionId,
  phone: workspaceHandoffPhones.phone,
  status: workspaceHandoffPhones.status,
  verifiedAt: workspaceHandoffPhones.verifiedAt,
};

export async function listHandoffPhonesForUsers(
  workspaceId: string,
  userIds: string[],
): Promise<WorkspaceHandoffPhoneRecord[]> {
  if (userIds.length === 0) return [];
  try {
    const rows = await db
      .select(phoneSelect)
      .from(workspaceHandoffPhones)
      .where(
        and(
          eq(workspaceHandoffPhones.workspaceId, workspaceId),
          inArray(workspaceHandoffPhones.userId, userIds),
        ),
      );
    console.info(
      `[${scope}/listHandoffPhonesForUsers] Success: workspaceId=${workspaceId} count=${rows.length}`,
    );
    return rows.map(mapPhoneRow);
  } catch (error) {
    console.error(
      `[${scope}/listHandoffPhonesForUsers] Unexpected error: ${String(error)}`,
    );
    return [];
  }
}

export async function getHandoffPhone(
  workspaceId: string,
  userId: string,
  whatsappConnectionId: string,
): Promise<WorkspaceHandoffPhoneRecord | null> {
  try {
    const [row] = await db
      .select(phoneSelect)
      .from(workspaceHandoffPhones)
      .where(
        and(
          eq(workspaceHandoffPhones.workspaceId, workspaceId),
          eq(workspaceHandoffPhones.userId, userId),
          eq(workspaceHandoffPhones.whatsappConnectionId, whatsappConnectionId),
        ),
      )
      .limit(1);
    if (!row) {
      console.info(
        `[${scope}/getHandoffPhone] Failed query: not found workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
      );
      return null;
    }
    console.info(
      `[${scope}/getHandoffPhone] Success: workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
    );
    return mapPhoneRow(row);
  } catch (error) {
    console.error(`[${scope}/getHandoffPhone] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function userHasVerifiedHandoffPhone(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: workspaceHandoffPhones.id })
      .from(workspaceHandoffPhones)
      .where(
        and(
          eq(workspaceHandoffPhones.workspaceId, workspaceId),
          eq(workspaceHandoffPhones.userId, userId),
          eq(workspaceHandoffPhones.status, "verified"),
        ),
      )
      .limit(1);
    console.info(
      `[${scope}/userHasVerifiedHandoffPhone] Success: workspaceId=${workspaceId} userId=${userId} has=${Boolean(row)}`,
    );
    return Boolean(row);
  } catch (error) {
    console.error(
      `[${scope}/userHasVerifiedHandoffPhone] Unexpected error: ${String(error)}`,
    );
    return false;
  }
}

export async function upsertHandoffPhonePending(
  workspaceId: string,
  userId: string,
  whatsappConnectionId: string,
  phone: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const existing = await getHandoffPhone(workspaceId, userId, whatsappConnectionId);
    if (existing) {
      await db
        .update(workspaceHandoffPhones)
        .set({
          phone,
          status: "pending",
          verifiedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workspaceHandoffPhones.workspaceId, workspaceId),
            eq(workspaceHandoffPhones.userId, userId),
            eq(workspaceHandoffPhones.whatsappConnectionId, whatsappConnectionId),
          ),
        );
    } else {
      await db.insert(workspaceHandoffPhones).values({
        workspaceId,
        userId,
        whatsappConnectionId,
        phone,
        status: "pending",
      });
    }
    console.info(
      `[${scope}/upsertHandoffPhonePending] Success: workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/upsertHandoffPhonePending] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "unexpected_error" };
  }
}

export async function markHandoffPhoneVerified(
  workspaceId: string,
  userId: string,
  whatsappConnectionId: string,
  phone: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await db
      .update(workspaceHandoffPhones)
      .set({
        phone,
        status: "verified",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceHandoffPhones.workspaceId, workspaceId),
          eq(workspaceHandoffPhones.userId, userId),
          eq(workspaceHandoffPhones.whatsappConnectionId, whatsappConnectionId),
        ),
      );
    console.info(
      `[${scope}/markHandoffPhoneVerified] Success: workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/markHandoffPhoneVerified] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "unexpected_error" };
  }
}

export async function clearHandoffPhone(
  workspaceId: string,
  userId: string,
  whatsappConnectionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await db
      .delete(workspaceHandoffPhones)
      .where(
        and(
          eq(workspaceHandoffPhones.workspaceId, workspaceId),
          eq(workspaceHandoffPhones.userId, userId),
          eq(workspaceHandoffPhones.whatsappConnectionId, whatsappConnectionId),
        ),
      );
    await db
      .delete(workspaceHandoffPhoneVerifications)
      .where(
        and(
          eq(workspaceHandoffPhoneVerifications.workspaceId, workspaceId),
          eq(workspaceHandoffPhoneVerifications.userId, userId),
          eq(workspaceHandoffPhoneVerifications.whatsappConnectionId, whatsappConnectionId),
        ),
      );
    console.info(
      `[${scope}/clearHandoffPhone] Success: workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/clearHandoffPhone] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function replaceHandoffPhoneVerification(input: {
  workspaceId: string;
  userId: string;
  whatsappConnectionId: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await db
      .delete(workspaceHandoffPhoneVerifications)
      .where(
        and(
          eq(workspaceHandoffPhoneVerifications.workspaceId, input.workspaceId),
          eq(workspaceHandoffPhoneVerifications.userId, input.userId),
          eq(
            workspaceHandoffPhoneVerifications.whatsappConnectionId,
            input.whatsappConnectionId,
          ),
        ),
      );
    await db.insert(workspaceHandoffPhoneVerifications).values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      whatsappConnectionId: input.whatsappConnectionId,
      phone: input.phone,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      attempts: 0,
    });
    console.info(
      `[${scope}/replaceHandoffPhoneVerification] Success: workspaceId=${input.workspaceId} userId=${input.userId} connectionId=${input.whatsappConnectionId}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/replaceHandoffPhoneVerification] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "unexpected_error" };
  }
}

export async function getHandoffPhoneVerification(
  workspaceId: string,
  userId: string,
  whatsappConnectionId: string,
): Promise<{
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
} | null> {
  try {
    const [row] = await db
      .select({
        phone: workspaceHandoffPhoneVerifications.phone,
        codeHash: workspaceHandoffPhoneVerifications.codeHash,
        expiresAt: workspaceHandoffPhoneVerifications.expiresAt,
        attempts: workspaceHandoffPhoneVerifications.attempts,
      })
      .from(workspaceHandoffPhoneVerifications)
      .where(
        and(
          eq(workspaceHandoffPhoneVerifications.workspaceId, workspaceId),
          eq(workspaceHandoffPhoneVerifications.userId, userId),
          eq(
            workspaceHandoffPhoneVerifications.whatsappConnectionId,
            whatsappConnectionId,
          ),
        ),
      )
      .limit(1);
    if (!row) {
      console.info(
        `[${scope}/getHandoffPhoneVerification] Failed query: not found workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
      );
      return null;
    }
    console.info(
      `[${scope}/getHandoffPhoneVerification] Success: workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
    );
    return row;
  } catch (error) {
    console.error(
      `[${scope}/getHandoffPhoneVerification] Unexpected error: ${String(error)}`,
    );
    return null;
  }
}

export async function incrementHandoffPhoneVerificationAttempts(
  workspaceId: string,
  userId: string,
  whatsappConnectionId: string,
): Promise<void> {
  try {
    const current = await getHandoffPhoneVerification(
      workspaceId,
      userId,
      whatsappConnectionId,
    );
    if (!current) return;
    await db
      .update(workspaceHandoffPhoneVerifications)
      .set({ attempts: current.attempts + 1 })
      .where(
        and(
          eq(workspaceHandoffPhoneVerifications.workspaceId, workspaceId),
          eq(workspaceHandoffPhoneVerifications.userId, userId),
          eq(
            workspaceHandoffPhoneVerifications.whatsappConnectionId,
            whatsappConnectionId,
          ),
        ),
      );
    console.info(
      `[${scope}/incrementHandoffPhoneVerificationAttempts] Success: workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
    );
  } catch (error) {
    console.error(
      `[${scope}/incrementHandoffPhoneVerificationAttempts] Unexpected error: ${String(error)}`,
    );
  }
}

export async function deleteHandoffPhoneVerification(
  workspaceId: string,
  userId: string,
  whatsappConnectionId: string,
): Promise<void> {
  try {
    await db
      .delete(workspaceHandoffPhoneVerifications)
      .where(
        and(
          eq(workspaceHandoffPhoneVerifications.workspaceId, workspaceId),
          eq(workspaceHandoffPhoneVerifications.userId, userId),
          eq(
            workspaceHandoffPhoneVerifications.whatsappConnectionId,
            whatsappConnectionId,
          ),
        ),
      );
    console.info(
      `[${scope}/deleteHandoffPhoneVerification] Success: workspaceId=${workspaceId} userId=${userId} connectionId=${whatsappConnectionId}`,
    );
  } catch (error) {
    console.error(
      `[${scope}/deleteHandoffPhoneVerification] Unexpected error: ${String(error)}`,
    );
  }
}

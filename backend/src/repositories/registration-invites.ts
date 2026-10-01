import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { registrationInvites } from "../db/schema/index.js";

const scope = "RegistrationInvitesRepository";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RegistrationInviteRow = typeof registrationInvites.$inferSelect;

export type PendingRegistrationInviteRecord = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createRegistrationInvite(
  email: string,
  createdByUserId: string | null,
): Promise<
  | { ok: true; inviteToken: string; invite: PendingRegistrationInviteRecord }
  | { ok: false; message: string }
> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, message: "invalid_email" };
  }

  try {
    const [pending] = await db
      .select({ id: registrationInvites.id })
      .from(registrationInvites)
      .where(
        and(
          eq(registrationInvites.email, normalized),
          isNull(registrationInvites.acceptedAt),
          gt(registrationInvites.expiresAt, new Date()),
        ),
      );

    if (pending) {
      console.info(`[${scope}/createRegistrationInvite] Failed query: duplicate pending invite`);
      return { ok: false, message: "invite_already_pending" };
    }

    const id = crypto.randomUUID();
    const inviteToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + INVITE_TTL_MS);

    await db.insert(registrationInvites).values({
      id,
      email: normalized,
      inviteToken,
      expiresAt,
      createdAt,
      createdByUserId,
    });

    console.info(`[${scope}/createRegistrationInvite] Success: email=${normalized}`);
    return {
      ok: true,
      inviteToken,
      invite: {
        id,
        email: normalized,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
    };
  } catch (error) {
    console.error(`[${scope}/createRegistrationInvite] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function listPendingRegistrationInvites(): Promise<PendingRegistrationInviteRecord[]> {
  try {
    const rows = await db
      .select({
        id: registrationInvites.id,
        email: registrationInvites.email,
        createdAt: registrationInvites.createdAt,
        expiresAt: registrationInvites.expiresAt,
      })
      .from(registrationInvites)
      .where(
        and(isNull(registrationInvites.acceptedAt), gt(registrationInvites.expiresAt, new Date())),
      )
      .orderBy(registrationInvites.createdAt);

    console.info(`[${scope}/listPendingRegistrationInvites] Success: count=${rows.length}`);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      created_at: r.createdAt.toISOString(),
      expires_at: r.expiresAt.toISOString(),
    }));
  } catch (error) {
    console.error(`[${scope}/listPendingRegistrationInvites] Unexpected error: ${String(error)}`);
    return [];
  }
}

export async function deleteRegistrationInvite(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const deleted = await db
      .delete(registrationInvites)
      .where(and(eq(registrationInvites.id, id), isNull(registrationInvites.acceptedAt)))
      .returning({ id: registrationInvites.id });

    if (deleted.length === 0) {
      console.info(`[${scope}/deleteRegistrationInvite] Failed query: invite not found id=${id}`);
      return { ok: false, message: "invite_not_found" };
    }

    console.info(`[${scope}/deleteRegistrationInvite] Success: id=${id}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/deleteRegistrationInvite] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

export async function getRegistrationInviteByToken(
  token: string,
): Promise<{ email: string; valid: boolean } | null> {
  try {
    const [row] = await db
      .select()
      .from(registrationInvites)
      .where(eq(registrationInvites.inviteToken, token));

    if (!row) {
      console.info(`[${scope}/getRegistrationInviteByToken] Success: found=false`);
      return null;
    }

    const valid =
      row.acceptedAt === null && row.expiresAt.getTime() > Date.now();

    console.info(`[${scope}/getRegistrationInviteByToken] Success: valid=${valid}`);
    return { email: row.email, valid };
  } catch (error) {
    console.error(`[${scope}/getRegistrationInviteByToken] Unexpected error: ${String(error)}`);
    return null;
  }
}

export async function acceptRegistrationInvite(
  token: string,
  userId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalized = normalizeEmail(email);

  try {
    const [row] = await db
      .select()
      .from(registrationInvites)
      .where(
        and(
          eq(registrationInvites.inviteToken, token),
          isNull(registrationInvites.acceptedAt),
          gt(registrationInvites.expiresAt, new Date()),
        ),
      );

    if (!row) {
      console.info(`[${scope}/acceptRegistrationInvite] Failed query: invalid or expired token`);
      return { ok: false, message: "invalid_invite" };
    }

    if (row.email !== normalized) {
      console.info(`[${scope}/acceptRegistrationInvite] Failed query: email mismatch`);
      return { ok: false, message: "invite_email_mismatch" };
    }

    await db
      .update(registrationInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(registrationInvites.id, row.id));

    console.info(`[${scope}/acceptRegistrationInvite] Success: userId=${userId}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/acceptRegistrationInvite] Unexpected error: ${String(error)}`);
    return { ok: false, message: "unexpected_error" };
  }
}

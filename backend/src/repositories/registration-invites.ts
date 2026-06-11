import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { registrationInvites } from "../db/schema/index.js";

const scope = "RegistrationInvitesRepository";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RegistrationInviteRow = typeof registrationInvites.$inferSelect;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createRegistrationInvite(
  email: string,
  createdByUserId: string | null,
): Promise<{ ok: true; inviteToken: string } | { ok: false; message: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { ok: false, message: "invalid_email" };
  }

  try {
    const [pending] = await db
      .select({ id: registrationInvites.id })
      .from(registrationInvites)
      .where(and(eq(registrationInvites.email, normalized), isNull(registrationInvites.acceptedAt)));

    if (pending) {
      console.info(`[${scope}/createRegistrationInvite] Failed query: duplicate pending invite`);
      return { ok: false, message: "invite_already_pending" };
    }

    const inviteToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await db.insert(registrationInvites).values({
      email: normalized,
      inviteToken,
      expiresAt,
      createdByUserId,
    });

    console.info(`[${scope}/createRegistrationInvite] Success: email=${normalized}`);
    return { ok: true, inviteToken };
  } catch (error) {
    console.error(`[${scope}/createRegistrationInvite] Unexpected error: ${String(error)}`);
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

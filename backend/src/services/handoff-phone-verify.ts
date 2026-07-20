import { randomInt } from "node:crypto";
import { phoneToWhatsappChatId } from "../lib/whatsapp-chat-id.js";
import { findUserById } from "../repositories/auth-users.js";
import {
  clearHandoffPhone,
  deleteHandoffPhoneVerification,
  getHandoffPhoneVerification,
  hashHandoffPhoneCode,
  incrementHandoffPhoneVerificationAttempts,
  markHandoffPhoneVerified,
  replaceHandoffPhoneVerification,
  upsertHandoffPhonePending,
} from "../repositories/handoff-phones.js";
import { getWorkspaceRow } from "../repositories/workspaces.js";
import {
  isWhatsappConnectionAuthorized,
  listConnections,
} from "../repositories/whatsapp.js";
import { sendTextMessageCompat as sendTextMessage } from "./whatsapp-client.js";

const scope = "HandoffPhoneVerify";
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function buildHandoffPhoneOtpText(input: {
  code: string;
  workspaceName: string;
  accountLabel: string;
}): string {
  return [
    `Your Senqo handoff confirmation code is ${input.code}`,
    "",
    `Workspace: ${input.workspaceName}`,
    `Account: ${input.accountLabel}`,
  ].join("\n");
}

export function normalizeHandoffPhone(input: string): string | null {
  const digits = input.trim().replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

function connectionPhoneDigits(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;
  return normalizeHandoffPhone(phoneNumber);
}

function isWorkspaceConnectionPhone(
  connections: Awaited<ReturnType<typeof listConnections>>,
  phone: string,
): boolean {
  return connections.some((c) => connectionPhoneDigits(c.phone_number) === phone);
}

export async function startHandoffPhoneVerification(input: {
  workspaceId: string;
  userId: string;
  phone: string;
  whatsappConnectionId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const phone = normalizeHandoffPhone(input.phone);
  if (!phone) {
    console.info(`[${scope}/start] Failed query: invalid_phone`);
    return { ok: false, message: "invalid_phone" };
  }

  const connectionId = input.whatsappConnectionId.trim();
  if (!connectionId) {
    console.info(`[${scope}/start] Failed query: invalid_connection`);
    return { ok: false, message: "invalid_connection" };
  }

  const connections = await listConnections(input.workspaceId);
  if (isWorkspaceConnectionPhone(connections, phone)) {
    console.info(`[${scope}/start] Failed query: phone_is_connection`);
    return { ok: false, message: "phone_is_connection" };
  }

  const connection = connections.find((c) => c.id === connectionId);
  if (!connection || !isWhatsappConnectionAuthorized(connection)) {
    console.info(`[${scope}/start] Failed query: no_whatsapp_connection`);
    return { ok: false, message: "no_whatsapp_connection" };
  }

  const chatId = phoneToWhatsappChatId(phone);
  if (!chatId) {
    console.info(`[${scope}/start] Failed query: invalid_phone chatId`);
    return { ok: false, message: "invalid_phone" };
  }

  const code = generateCode();
  const codeHash = hashHandoffPhoneCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const pending = await upsertHandoffPhonePending(
    input.workspaceId,
    input.userId,
    connectionId,
    phone,
  );
  if (!pending.ok) return pending;

  const saved = await replaceHandoffPhoneVerification({
    workspaceId: input.workspaceId,
    userId: input.userId,
    whatsappConnectionId: connectionId,
    phone,
    codeHash,
    expiresAt,
  });
  if (!saved.ok) return saved;

  const [workspace, user] = await Promise.all([
    getWorkspaceRow(input.workspaceId),
    findUserById(input.userId),
  ]);
  const workspaceName = workspace?.name?.trim() || input.workspaceId;
  const accountLabel = user?.email?.trim() || input.userId;

  try {
    await sendTextMessage(connectionId, {
      chatId,
      text: buildHandoffPhoneOtpText({
        code,
        workspaceName,
        accountLabel,
      }),
    });
  } catch (error) {
    console.error(
      `[${scope}/start] Unexpected error: WhatsApp send failed workspaceId=${input.workspaceId} ${String(error)}`,
    );
    return { ok: false, message: "send_failed" };
  }

  console.info(
    `[${scope}/start] Success: workspaceId=${input.workspaceId} userId=${input.userId} connectionId=${connectionId}`,
  );
  return { ok: true };
}

export async function confirmHandoffPhoneVerification(input: {
  workspaceId: string;
  userId: string;
  whatsappConnectionId: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const code = input.code.trim();
  const connectionId = input.whatsappConnectionId.trim();
  if (!connectionId) {
    console.info(`[${scope}/confirm] Failed query: invalid_connection`);
    return { ok: false, message: "invalid_connection" };
  }
  if (!/^\d{6}$/.test(code)) {
    console.info(`[${scope}/confirm] Failed query: invalid_code format`);
    return { ok: false, message: "invalid_code" };
  }

  const verification = await getHandoffPhoneVerification(
    input.workspaceId,
    input.userId,
    connectionId,
  );
  if (!verification) {
    console.info(`[${scope}/confirm] Failed query: no pending verification`);
    return { ok: false, message: "invalid_code" };
  }

  if (verification.expiresAt.getTime() < Date.now()) {
    console.info(`[${scope}/confirm] Failed query: code_expired`);
    return { ok: false, message: "code_expired" };
  }

  if (verification.attempts >= MAX_ATTEMPTS) {
    console.info(`[${scope}/confirm] Failed query: too_many_attempts`);
    return { ok: false, message: "too_many_attempts" };
  }

  const expected = verification.codeHash;
  const actual = hashHandoffPhoneCode(code);
  if (actual !== expected) {
    await incrementHandoffPhoneVerificationAttempts(
      input.workspaceId,
      input.userId,
      connectionId,
    );
    console.info(`[${scope}/confirm] Failed query: invalid_code`);
    return { ok: false, message: "invalid_code" };
  }

  const marked = await markHandoffPhoneVerified(
    input.workspaceId,
    input.userId,
    connectionId,
    verification.phone,
  );
  if (!marked.ok) return marked;

  await deleteHandoffPhoneVerification(input.workspaceId, input.userId, connectionId);
  console.info(
    `[${scope}/confirm] Success: workspaceId=${input.workspaceId} userId=${input.userId} connectionId=${connectionId}`,
  );
  return { ok: true };
}

export async function clearHandoffPhoneRegistration(input: {
  workspaceId: string;
  userId: string;
  whatsappConnectionId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const connectionId = input.whatsappConnectionId.trim();
  if (!connectionId) {
    return { ok: false, message: "invalid_connection" };
  }
  return clearHandoffPhone(input.workspaceId, input.userId, connectionId);
}

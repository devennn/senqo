import { env } from "../lib/env.js";
import { sendEmail } from "../lib/email.js";

const scope = "EmailService";

type WhatsappDisconnectEmailInput = {
  to: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  disconnectedAt?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDisconnectTime(value?: string | null): string {
  if (!value) return "the webhook was received";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the webhook was received";
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

type RegistrationInviteEmailInput = {
  to: string;
  inviteToken: string;
};

export async function sendRegistrationInviteEmail(
  input: RegistrationInviteEmailInput,
): Promise<{ ok: boolean }> {
  const signupUrl = `${env.frontendUrl.replace(/\/$/, "")}/sign-up?invite=${encodeURIComponent(input.inviteToken)}`;

  try {
    await sendEmail({
      to: input.to,
      subject: "You're invited to join Senqo",
      html: `<p>You have been invited to join Senqo.</p><p><a href="${escapeHtml(signupUrl)}">Create your account</a></p><p>This link expires in 7 days.</p>`,
    });
    console.info(
      `[${scope}/sendRegistrationInviteEmail] Success: to=${input.to}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/sendRegistrationInviteEmail] Unexpected error: ${String(error)}`,
    );
    return { ok: false };
  }
}

export async function sendWhatsappDisconnectEmail(
  input: WhatsappDisconnectEmailInput,
): Promise<{ ok: boolean }> {
  const connectionLabel =
    input.displayName?.trim() ||
    input.phoneNumber?.trim() ||
    "your WhatsApp connection";
  const disconnectedAt = formatDisconnectTime(input.disconnectedAt);

  try {
    await sendEmail({
      to: input.to,
      subject: `WhatsApp disconnected: ${connectionLabel}`,
      html: `<p>We detected that this WhatsApp account is no longer connected, so the active connection <strong>${escapeHtml(connectionLabel)}</strong> was removed from the Connect page.</p><p>Time: ${escapeHtml(disconnectedAt)}</p><p>You can view the recent activity feed on the Connect page for the audit trail and reconnect when you are ready.</p>`,
    });

    console.info(
      `[${scope}/sendWhatsappDisconnectEmail] Success: userId=${input.to}`,
    );
    return { ok: true };
  } catch (error) {
    console.error(
      `[${scope}/sendWhatsappDisconnectEmail] Unexpected error: ${String(error)}`,
    );
    return { ok: false };
  }
}

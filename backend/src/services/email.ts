import { Resend } from "resend";
import { env } from "../lib/env.js";

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
  // dateStyle/timeStyle cannot be combined with timeZoneName in some Node ICU builds.
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

export async function sendWhatsappDisconnectEmail(input: WhatsappDisconnectEmailInput): Promise<{ ok: boolean }> {
  if (!env.resendApiKey) {
    console.error(`[${scope}/sendWhatsappDisconnectEmail] Failed query: RESEND_API_KEY is not configured`);
    return { ok: false };
  }

  const connectionLabel = input.displayName?.trim() || input.phoneNumber?.trim() || "your WhatsApp connection";
  const disconnectedAt = formatDisconnectTime(input.disconnectedAt);
  const text = [
    `WhatsApp disconnected: ${connectionLabel}`,
    "",
    "We detected that this WhatsApp account is no longer connected, so the active connection was removed from the Connect page.",
    `Time: ${disconnectedAt}`,
    "",
    "You can view the recent activity feed on the Connect page for the audit trail and reconnect when you are ready.",
  ].join("\n");

  try {
    const resend = new Resend(env.resendApiKey);
    const { error } = await resend.emails.send({
      from: env.resendFromEmail,
      to: input.to,
      subject: `WhatsApp disconnected: ${connectionLabel}`,
      text,
      html: `<p>We detected that this WhatsApp account is no longer connected, so the active connection <strong>${escapeHtml(connectionLabel)}</strong> was removed from the Connect page.</p><p>Time: ${escapeHtml(disconnectedAt)}</p><p>You can view the recent activity feed on the Connect page for the audit trail and reconnect when you are ready.</p>`,
    });

    if (error) {
      console.error(`[${scope}/sendWhatsappDisconnectEmail] Failed query: ${error.message}`);
      return { ok: false };
    }

    console.info(`[${scope}/sendWhatsappDisconnectEmail] Success: userId=${input.to}`);
    return { ok: true };
  } catch (error) {
    console.error(`[${scope}/sendWhatsappDisconnectEmail] Unexpected error: ${String(error)}`);
    return { ok: false };
  }
}

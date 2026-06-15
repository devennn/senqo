import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendEmail = vi.fn();

vi.mock("../lib/email.js", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("../lib/env.js", () => ({
  env: { frontendUrl: "http://localhost:5173" },
}));

const { sendRegistrationInviteEmail, sendWhatsappDisconnectEmail } = await import(
  "./email.js"
);

beforeEach(() => {
  vi.clearAllMocks();
  mockSendEmail.mockResolvedValue(undefined);
});

describe("sendRegistrationInviteEmail", () => {
  // SMTP send succeeds → returns ok:true and delivers invite with encoded signup URL, needed to verify the registration invite flow triggers email delivery.
  it("returns ok:true and sends invite email with signup URL", async () => {
    const result = await sendRegistrationInviteEmail({
      to: "invitee@example.com",
      inviteToken: "token/with+special",
    });

    expect(result).toEqual({ ok: true });
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: "invitee@example.com",
      subject: "You're invited to join Senqo",
      html: expect.stringContaining(
        "http://localhost:5173/sign-up?invite=token%2Fwith%2Bspecial",
      ),
    });
  });

  // Underlying SMTP transport fails → returns ok:false without throwing, needed so invite routes can surface emailSent:false to the client.
  it("returns ok:false when sendEmail throws", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP connection refused"));

    const result = await sendRegistrationInviteEmail({
      to: "invitee@example.com",
      inviteToken: "abc123",
    });

    expect(result).toEqual({ ok: false });
  });
});

describe("sendWhatsappDisconnectEmail", () => {
  // Valid input with display name → returns ok:true and includes escaped connection label in subject and body, needed to verify disconnect notifications reach the owner.
  it("returns ok:true and sends disconnect email with display name", async () => {
    const result = await sendWhatsappDisconnectEmail({
      to: "owner@example.com",
      displayName: "Support Line",
      disconnectedAt: "2026-06-15T14:30:00.000Z",
    });

    expect(result).toEqual({ ok: true });
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: "owner@example.com",
      subject: "WhatsApp disconnected: Support Line",
      html: expect.stringContaining("<strong>Support Line</strong>"),
    });
  });

  // Display name is empty but phone number is set → subject uses phone number as the connection label, needed when contacts lack a friendly name.
  it("falls back to phone number when display name is missing", async () => {
    await sendWhatsappDisconnectEmail({
      to: "owner@example.com",
      displayName: "   ",
      phoneNumber: "+15551234567",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "WhatsApp disconnected: +15551234567",
        html: expect.stringContaining("<strong>+15551234567</strong>"),
      }),
    );
  });

  // Neither display name nor phone number → generic connection label is used, needed for minimal disconnect webhook payloads.
  it("falls back to generic label when name and phone are missing", async () => {
    await sendWhatsappDisconnectEmail({
      to: "owner@example.com",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "WhatsApp disconnected: your WhatsApp connection",
      }),
    );
  });

  // Connection label contains HTML metacharacters → they are escaped in the email body, needed to prevent HTML injection in notification content.
  it("escapes HTML in connection label", async () => {
    await sendWhatsappDisconnectEmail({
      to: "owner@example.com",
      displayName: '<script>alert("x")</script>',
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
        ),
      }),
    );
  });

  // disconnectedAt is missing or invalid → body uses webhook fallback text instead of a formatted timestamp, needed for partial webhook data.
  it("uses fallback disconnect time when timestamp is invalid", async () => {
    await sendWhatsappDisconnectEmail({
      to: "owner@example.com",
      displayName: "Line 1",
      disconnectedAt: "not-a-date",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Time: the webhook was received"),
      }),
    );
  });

  // Underlying SMTP transport fails → returns ok:false without throwing, needed so disconnect handlers do not crash on mail errors.
  it("returns ok:false when sendEmail throws", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP timeout"));

    const result = await sendWhatsappDisconnectEmail({
      to: "owner@example.com",
      displayName: "Line 1",
    });

    expect(result).toEqual({ ok: false });
  });
});

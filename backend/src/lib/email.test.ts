import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
}));

const envMock = {
  smtpHost: "smtp.example.com",
  smtpPort: "587",
  smtpUser: "smtp-user",
  smtpPass: "smtp-pass",
  smtpFromEmail: "Senqo <no-reply@example.com>",
};

vi.mock("./env.js", () => ({
  env: envMock,
}));

const { sendEmail } = await import("./email.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockSendMail.mockResolvedValue({ messageId: "msg-123" });
  process.env.SMTP_FROM_EMAIL = "Senqo <no-reply@example.com>";
  Object.assign(envMock, {
    smtpHost: "smtp.example.com",
    smtpPort: "587",
    smtpUser: "smtp-user",
    smtpPass: "smtp-pass",
    smtpFromEmail: "Senqo <no-reply@example.com>",
  });
});

describe("sendEmail", () => {
  // All SMTP env vars are set → creates transport with port 587 (non-secure) and sends mail, needed to verify the nodemailer wiring for typical submission ports.
  it("creates SMTP transport and sends mail on port 587", async () => {
    await sendEmail({
      to: "recipient@example.com",
      subject: "Test subject",
      html: "<p>Hello</p>",
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "smtp-user", pass: "smtp-pass" },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: "Senqo <no-reply@example.com>",
      to: "recipient@example.com",
      cc: undefined,
      bcc: undefined,
      subject: "Test subject",
      html: "<p>Hello</p>",
    });
  });

  // SMTP port is 465 → transport is created with secure:true, needed because implicit TLS uses a different nodemailer mode than STARTTLS on 587.
  it("uses secure transport when SMTP port is 465", async () => {
    envMock.smtpPort = "465";

    await sendEmail({
      to: "recipient@example.com",
      subject: "Secure test",
    });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  // Required SMTP configuration is missing → throws before contacting nodemailer, needed to fail fast when email is misconfigured.
  it("throws when SMTP configuration is incomplete", async () => {
    envMock.smtpHost = "";

    await expect(
      sendEmail({
        to: "recipient@example.com",
        subject: "Test",
      }),
    ).rejects.toThrow(
      "[EmailService/sendEmail] smtpHost, smtpPort, smtpUser, smtpPass, and smtpFromEmail must be set",
    );
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });
});

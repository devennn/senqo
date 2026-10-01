import nodemailer from "nodemailer";
import { env } from "../lib/env.js";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true for port 465, false for 587
  user: string;
  pass: string;
}

const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;

function createTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
}

async function sendEmail(options: EmailOptions): Promise<void> {
  if (
    !env.smtpHost ||
    !env.smtpPort ||
    !env.smtpUser ||
    !env.smtpPass ||
    !env.smtpFromEmail
  ) {
    throw new Error(
      "[EmailService/sendEmail] smtpHost, smtpPort, smtpUser, smtpPass, and smtpFromEmail must be set",
    );
  }

  const config: SmtpConfig = {
    host: env.smtpHost,
    port: parseInt(env.smtpPort),
    secure: parseInt(env.smtpPort) === 465,
    user: env.smtpUser,
    pass: env.smtpPass,
  };
  const transporter = createTransporter(config);

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    html: options.html,
  });

  console.info(`[EmailService/sendEmail] Message sent: ${info.messageId}`);
}

export { sendEmail };

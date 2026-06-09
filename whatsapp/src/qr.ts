import QRCode from "qrcode";
import { logger } from "./logger.js";

/** Latest QR (as a PNG data URL) per connection, mirroring the backend's expectation. */
const qrBySession = new Map<string, string>();

export async function setSessionQr(connectionId: string, qrString: string): Promise<void> {
  try {
    const dataUrl = await QRCode.toDataURL(qrString, { margin: 1, scale: 6 });
    qrBySession.set(connectionId, dataUrl);
  } catch (error) {
    logger.error({ connectionId, error: String(error) }, "failed to render QR to data URL");
  }
}

export function getSessionQr(connectionId: string): string | undefined {
  return qrBySession.get(connectionId);
}

export function clearSessionQr(connectionId: string): void {
  qrBySession.delete(connectionId);
}

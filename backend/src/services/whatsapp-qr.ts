import { getQrCode, type QrResponse } from "./whatsapp-client.js";

const scope = "WhatsappQr";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls the WhatsApp service until a QR or authorized state is available. */
export async function waitForQrCode(
  connectionId: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<QrResponse> {
  const maxAttempts = options?.maxAttempts ?? 30;
  const intervalMs = options?.intervalMs ?? 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await getQrCode(connectionId);
      if (res.type === "qrCode" || res.type === "alreadyLogged") {
        console.info(`[${scope}] Success: connectionId=${connectionId} attempt=${attempt}`);
        return res;
      }
    } catch (error) {
      const message = String(error);
      if (!message.includes("404") && !message.includes("QR not available")) {
        throw error;
      }
    }
    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  console.info(`[${scope}] Timeout: connectionId=${connectionId}`);
  return { type: "error", message: "QR not available yet" };
}

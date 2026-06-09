import { env } from "../lib/env.js";

export type DownloadMediaResponse = {
  data: ArrayBuffer;
  mimeType: string | null;
};

const scope = "WhatsappMedia";

export async function downloadIncomingMedia(downloadUrl: string): Promise<DownloadMediaResponse> {
  try {
    const url = new URL(downloadUrl);
    const isDev = process.env.NODE_ENV !== "production";
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`Blocked URL protocol: ${downloadUrl}`);
    }
    if (url.protocol === "http:" && !isDev) {
      throw new Error(`Blocked non-HTTPS URL: ${downloadUrl}`);
    }
    const extraHosts = (process.env.WHATSAPP_MEDIA_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    const allowedHosts = ["localhost", "whatsapp", "127.0.0.1", ...extraHosts];
    const isAllowed = allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    if (!isAllowed) {
      throw new Error(`Blocked non-allowed host: ${url.hostname}`);
    }
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(`Invalid URL: ${downloadUrl}`);
    }
    throw e;
  }

  console.log(`[${scope}/downloadIncomingMedia] Request`, { url: downloadUrl });

  const apiKey = env.whatsappServiceApiKey;
  const response = await fetch(downloadUrl, {
    headers: apiKey ? { "x-api-key": apiKey } : {},
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Download media failed (${response.status}): ${bodyText}`);
  }
  const data = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type");
  console.log(`[${scope}/downloadIncomingMedia] Success`, {
    url: downloadUrl,
    bytes: data.byteLength,
    mimeType,
  });
  return { data, mimeType };
}
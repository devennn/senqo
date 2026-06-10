import { assertSafeFetchUrl } from "./ssrf.js";

export async function sandboxFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } | undefined,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: string }> {
  await assertSafeFetchUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.headers,
      body: init?.body,
      signal: controller.signal,
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

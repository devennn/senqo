import { Agent } from "undici";
import { resolveSafeFetchTarget, type SafeFetchTarget } from "./ssrf.js";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

/** Headers a native fetch would drop on a cross-origin redirect; mirror that here. */
const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "proxy-authorization"]);

function stripSensitiveHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase())),
  );
}

/**
 * Pins the connection to the pre-validated address so the DNS answer cannot change
 * between validation and connect (closes the rebinding TOCTOU window, S-06).
 */
function createPinnedAgent(target: SafeFetchTarget): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        if (options?.all) {
          callback(null, [{ address: target.address, family: target.family }]);
          return;
        }
        callback(null, target.address, target.family);
      },
    },
  });
}

export async function sandboxFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } | undefined,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: string }> {
  let currentUrl = url;
  let method = init?.method ?? "GET";
  let body = init?.body;
  let headers = init?.headers;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = await resolveSafeFetchTarget(currentUrl);
    const agent = createPinnedAgent(target);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target.url, {
        method,
        headers,
        body,
        signal: controller.signal,
        // Redirects are handled manually so every hop is re-validated (the target of a
        // redirect is exactly the kind of URL the guard exists to check).
        redirect: "manual",
        dispatcher: agent,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("Redirect without a Location header.");
        if (hop === MAX_REDIRECTS) throw new Error("Too many redirects.");

        const next = new URL(location, target.url);
        if (next.origin !== target.url.origin) {
          headers = stripSensitiveHeaders(headers);
        }
        currentUrl = next.toString();
        if (response.status === 303) {
          method = "GET";
          body = undefined;
        }
        continue;
      }

      const textBody = await response.text();
      return { ok: response.ok, status: response.status, body: textBody };
    } finally {
      clearTimeout(timer);
      void agent.close();
    }
  }

  throw new Error("Too many redirects.");
}

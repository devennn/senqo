import type { MiddlewareHandler } from "hono";

/**
 * Request logger that never includes the query string. Secrets (webhook tokens,
 * realtime tickets, invite tokens) historically rode in URLs and ended up in
 * logs; endpoint identity is fully described by method + path, so there is no
 * reason to log the rest.
 */
export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    console.log(`<-- ${c.req.method} ${c.req.path}`);
    await next();
    console.log(
      `--> ${c.req.method} ${c.req.path} ${c.res.status} - ${Date.now() - start}ms`,
    );
  };
}

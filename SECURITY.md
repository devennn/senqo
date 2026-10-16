# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** via GitHub's
["Report a vulnerability"](https://github.com/devennn/senqo/security/advisories/new)
(private security advisory) on this repository — do not open a public issue for
anything exploitable.

Include: affected component (backend / frontend / whatsapp service), a
description of the impact, and reproduction steps if possible. We aim to
acknowledge reports within a few days.

## Supported versions

The `main` branch and the latest tagged release receive security fixes.
Self-hosted deployments should redeploy (`docker compose ... up -d --build`)
after security fixes land — the backend and the whatsapp service are upgraded
together as a pair.

## Posture and reviewed decisions

This section records security-relevant decisions that may look surprising on a
first read:

- **In-memory rate limiting and login lockout.** Limits live in a per-process
  `Map`, keyed on `x-real-ip` (set and overwritten by the shipped nginx so
  client-supplied `X-Forwarded-For` values cannot move the key). This is
  intentional for the single-backend deployment; running multiple backend
  replicas would require a shared store first.
- **Webhook authentication.** The whatsapp service authenticates to
  `POST /api/whatsapp/events` with the `WHATSAPP_WEBHOOK_AUTHORIZATION` shared
  secret in the `x-webhook-token` header (timing-safe compare). Secrets never
  travel in URLs, and the request logger does not log query strings.
- **Realtime stream tickets.** The dashboard exchanges its access token for a
  single-use, 30-second ticket (`POST /api/realtime/ticket`) because
  `EventSource` cannot set an `Authorization` header. Reusable tokens are never
  placed in the stream URL.
- **`/api/health` reports the app version and timestamp.** This powers the
  version label in the UI and is intentional (rated informational, not a
  finding). It exposes no configuration or environment data.
- **nginx forwards the client `Host` header.** The backend validates it against
  `API_URL` / `FRONTEND_URL` allowlists (`apiHostGuardMiddleware`) and rejects
  unknown hosts, so forwarding it is safe as used.
- **`xlsx` advisories are allowlisted** in `scripts/audit-prod.mjs`: SheetJS no
  longer publishes fixed releases to the npm registry (GHSA-4r6h-8v6p-xvw6,
  GHSA-5pgg-2g8v-p4x9). Spreadsheet parsing of untrusted uploads should be
  reviewed if that support is expanded.
- **Webhook payload dumps** (raw message content used for debugging webhook
  issues) are pruned daily; `WHATSAPP_PAYLOAD_DUMP_RETENTION_DAYS` controls the
  window (`0` keeps them forever).
- **Password policy** is length-based (minimum 12 characters) plus a local
  common/breached blocklist; `PASSWORD_BREACH_CHECK=on` additionally screens
  against HaveIBeenPwned using k-anonymity (only a 5-character SHA-1 prefix
  leaves the server). Composition rules are deliberately not used
  (NIST 800-63B).

## Dependency auditing

`node scripts/audit-prod.mjs` fails CI when production dependencies gain
high/critical advisories that are not explicitly allowlisted (with a documented
reason) in that script. Dependabot opens weekly grouped updates.

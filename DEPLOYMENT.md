# Senqo — Deployment

Production deployment guide. For local development and testing, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Build and run (production images)

Build and start the full stack with production images (no hot reload):

```bash
docker compose up -d --build
```

> First start builds the `whatsapp` (Baileys) image and installs its npm dependencies — expect a minute or two. Subsequent starts are fast.

Docker builds the app, starts Postgres, applies the schema via Drizzle (`database/migrations/`, baseline `0000_init.sql`), then starts the app services.

Rebuild after changing code or dependencies:

```bash
docker compose up -d --build
```

## Production notes

- **Database**: Point `DATABASE_URL` at managed Postgres, remove the `postgres` service from Compose, and run migrations against that URL (`docker compose run --rm migrate` with `DATABASE_URL` set in `.env`). Schema source of truth: `database/migrations/`.
- **Storage**: Already external (Cloudflare R2 — see [Storage: Cloudflare R2](DEVELOPMENT.md#storage-cloudflare-r2)). For a dedicated production bucket, create a second R2 bucket + token and swap the `S3_*` values; AWS S3 / any S3-compatible store also works by changing `S3_ENDPOINT`.
- **Domain**: Set `FRONTEND_URL` to your domain and put nginx/Caddy in front for HTTPS. Add any extra browser origins (e.g. preview deploys) to `ALLOWED_PRODUCTION_ORIGINS` (comma-separated hostnames) or their CORS requests are rejected.
- **Secrets**: Never commit `.env`. Generate strong random values for `JWT_SECRET`, `API_KEY_PEPPER`, and `WHATSAPP_WEBHOOK_AUTHORIZATION` (`openssl rand -hex 32` / `openssl rand -hex 16`).

## Architecture & stack

See [Architecture](DEVELOPMENT.md#architecture) and [Stack](DEVELOPMENT.md#stack) in DEVELOPMENT.md for the runtime topology, service ports, and technology breakdown.

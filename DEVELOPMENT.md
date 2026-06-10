# Senqo — Development

Local development and testing guide. For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Runtime:** Node.js **22.12+** (Docker images use `node:22-alpine`; local dev should match).

## Quick start (Docker Compose)

Everything runs in Docker — Postgres and the app in one command; file storage is Cloudflare R2 (free tier, set up once).

### 1. Clone and configure

```bash
git clone https://github.com/your-org/senqo.git
cd senqo
cp .env.example .env
```

Use this repo-root `.env` only — Docker Compose reads it for variable substitution and service config. (Retired per-package env files live under `.env.old/` if you need to recover values.)

In `.env`, set at least:

- `JWT_SECRET` and `API_KEY_PEPPER` — generate with `openssl rand -hex 32` and `openssl rand -hex 16`
- `OPENROUTER_API_KEY` and `RESEND_API_KEY` — required for the backend process to start (AI, scheduled tasks via pg-boss, email)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — object storage for media/attachments. Use **Cloudflare R2** (free tier); see [Storage: Cloudflare R2](#storage-cloudflare-r2) below.

Bundled Compose values (usually leave as in `.env.example`):

- `DATABASE_URL=postgresql://senqo:senqo@postgres:5432/senqo`
- `S3_REGION=auto`, `S3_BUCKET=senqo-wa`
- `WHATSAPP_WEBHOOK_AUTHORIZATION` — shared secret used as the webhook `?token=` the backend validates (Compose default: `developmentauthtoken`)
- `WHATSAPP_SERVICE_URL=http://whatsapp:8080` — backend → the first-party Baileys `whatsapp` service inside Docker (host port **3002** maps to container **8080**)
- `WHATSAPP_SERVICE_API_KEY` — shared secret the backend sends to the `whatsapp` service as the `x-api-key` header (a password you choose; must match on both services)

### 2. Start

**Production-style (built images, no hot reload):**

```bash
docker compose up -d --build
```

> First start builds the `whatsapp` (Baileys) image and installs its npm dependencies — expect a minute or two. Subsequent starts are fast.

**Local development (watch source; rebuild images only when dependencies change):**

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up
```

App code is bind-mounted; `backend`, `frontend`, and `whatsapp` all hot-reload in dev (`tsx watch` / Vite). After editing `package.json` or `package-lock.json` in a service, rebuild that service:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml build backend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d backend
```

Docker pulls images, builds the app, starts Postgres, applies the schema via Drizzle (`database/migrations/`, baseline `0000_init.sql`), then starts the app services. First run takes ~3 minutes.

### 3. Open

```
http://<your-vps-ip>:8080
```

Sign up with any email and password. That account becomes the workspace owner. Then open **Connect** and scan the WhatsApp QR code to link a number (the `whatsapp` service).

**Compose note:** The `whatsapp` service is our own lightweight Node service (`whatsapp/`) built directly on **[Baileys](https://github.com/WhiskeySockets/Baileys)** — no headless browser. It holds one Baileys socket per connection and exposes a small REST API to the backend (start/QR/state/restart/logout/delete, send-text/send-media/presence), authenticated with the `WHATSAPP_SERVICE_API_KEY` (`x-api-key` header). It needs no database — auth state persists under **`whatsapp/sessions/`** on the host (bind-mounted into the container; gitignored), so restarts reconnect without a new QR. Service logs append to **`whatsapp/logs/whatsapp.log`** (JSON lines; gitignored) for grep/search alongside `docker logs`. The backend talks to it through `backend/src/services/whatsapp-client.ts`.

Inbound events flow the other way: the `whatsapp` service pushes canonical `WhatsappBackendEvent`s (`connection.state`, `message.inbound`, `message.outbound_mirror`) to the backend at `/api/whatsapp/events?token=<WHATSAPP_WEBHOOK_AUTHORIZATION>`. The QR is rendered to a data URL and pulled by the backend; the webhook delivers QR/connection updates, inbound messages (text/image/audio/file, incl. groups), and self-message mirrors. Media is downloaded by the service and inlined as base64. WhatsApp **LID (privacy)** identifiers are resolved to phone-number JIDs in `whatsapp/src/jid.ts` so conversations attach to the right contacts.

---

## Services

| Service | Port | What it does |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL 18 (persistent volume `pg_data`) |
| `migrate` | — | One-shot — `drizzle-kit migrate` on `database/migrations/` |
| `backend` | 3001 | Hono API (auth, agents, WhatsApp webhooks, CRM) |
| `frontend` | 8080 | Nginx serving the React SPA + proxying `/api` |
| `whatsapp` | 3002→8080 | First-party [Baileys](https://github.com/WhiskeySockets/Baileys) session manager (`whatsapp/`); REST in, canonical webhooks → backend; auth state in `whatsapp/sessions/` (host bind mount) |

File storage is external (Cloudflare R2), not a Compose service — see below.

## Storage: Cloudflare R2

Media and attachments live in an S3-compatible bucket. We use **Cloudflare R2**, whose free tier (10 GB storage + generous egress) is enough to run Senqo. Unlike a self-hosted bucket on an internal Docker hostname, R2 has a public S3 endpoint, so the presigned URLs the backend hands the browser load directly.

1. **Create an account / bucket.** Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → enable it (free; a card may be required but the free tier isn't billed). Click **Create bucket**, name it `senqo-wa`, and create.
2. **Find your account ID.** On the R2 overview page, copy the **Account ID** (also the subdomain in the S3 API endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`).
3. **Create an API token.** R2 → **Manage R2 API Tokens** → **Create Account API token**. Set **Permissions** to **Object Read & Write**, under **Specify bucket(s)** scope it to `senqo-wa`, then create. Copy the **Access Key ID** and **Secret Access Key** (shown once) — these are your `S3_ACCESS_KEY` / `S3_SECRET_KEY`. Ignore the "Token value" and the auto-generated endpoint on that page; use the account endpoint from step 2.
4. **Fill `.env`:**

   ```bash
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=senqo-wa
   S3_ACCESS_KEY=<Access Key ID>
   S3_SECRET_KEY=<Secret Access Key>
   ```

5. **Apply:** `docker compose up -d backend`.

The bucket stays private — Senqo serves files via short-lived presigned URLs, so you do **not** need to enable public access or a custom R2 domain.

## Integrating external services

To unlock full functionality, add these to `.env`:

| Variable | Needed for | Get it at |
|----------|-----------|----------|
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Media & attachment storage | Cloudflare R2 — see [Storage: Cloudflare R2](#storage-cloudflare-r2) |
| `OPENROUTER_API_KEY` | AI agent | [openrouter.ai](https://openrouter.ai) |
| `RESEND_API_KEY` | Email invites | [resend.com](https://resend.com) |
| `WHATSAPP_WEBHOOK_AUTHORIZATION` | WhatsApp webhook auth | Shared secret sent as the webhook `?token=` and validated by the backend |
| `WHATSAPP_SERVICE_URL` | Backend → WhatsApp service | Only if not using Compose defaults (`http://whatsapp:8080`) |
| `WHATSAPP_SERVICE_API_KEY` | Backend ↔ WhatsApp service auth | Shared secret sent as the `x-api-key` header; must match on both services |
| `WORKSPACE_SECRETS_KEY` | Encrypted workspace secrets for custom tools | `openssl rand -hex 32` |
| `NODE_OPTIONS=--no-node-snapshot` | isolated-vm on Node 20+ | Set in Compose for `backend` (production image includes it) |

Without OpenRouter/Resend keys the backend will not start. Scheduled tasks and inbound AI debounce use **pg-boss** on the same Postgres database (no external queue account). Media (images, documents) won't display without working R2 credentials. WhatsApp linking still needs the `whatsapp` service running after the stack is up.

**Deploy note:** Tasks created before a QStash → pg-boss migration may have legacy scheduler metadata; cancel/recreate them if a pending run does not fire after upgrade.

## Custom agent tools

- **Migrate** seeds the demo `get_weather` tool for every workspace (`seed-all-workspace-custom-tools.ts` runs after Drizzle migrate).
- **New workspaces** also get the demo tool on first signup (`ensureProfile`).
- Repair one workspace: `cd backend && npm run tools:seed -- -w <workspaceId>`

## Useful commands

```bash
# Dev stack with hot reload (see Quick start)
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml logs -f backend

# View logs
docker compose logs -f backend

# Restart after changing .env
docker compose up -d backend

# Rebuild production images (code or deps)
docker compose up -d --build

# Reset everything (WARNING: deletes the DB volume; re-applies 0000_init. R2 storage is external and untouched.)
docker compose down -v
docker compose up -d --build

# Run migrations manually (same SQL as first boot)
docker compose run --rm migrate

# Generate a new migration after editing backend/src/db/schema/ (from backend/)
cd backend && npx drizzle-kit generate --name <tag>
# New files land in database/migrations/

# Browse uploaded files: Cloudflare dashboard → R2 → senqo-wa bucket
```

## Testing

```bash
# All unit tests (backend + frontend + whatsapp)
npm test

# Single package
npm run test:backend     # backend/src/**/*.test.ts
npm run test:frontend    # frontend/src/**/*.test.{ts,tsx}
npm run test:whatsapp    # whatsapp/src/**/*.test.ts

# Watch mode (any package)
cd backend && npm run test:watch
cd frontend && npm run test:watch
cd whatsapp && npm run test:watch

# E2E (Playwright, requires stack running — see below)
npm run test:e2e
```

**E2E tests** mock API calls at the browser boundary by default (no real database). `npm run test:e2e` starts the frontend on port **5199** (`E2E_DEV_PORT`) or use `E2E_BASE_URL=http://localhost:8080` with Docker Compose. Feature specs target **~3 tests** each (happy path + critical behaviour); see `e2e/custom-tools.spec.ts`.

**Repository tests** (principle 6 in `AGENTS.md`) hit a real Postgres. Start the Docker stack first:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
cd backend && npm test
```

**Test architecture**: see `AGENTS.md` section 13 for testing principles and quality gates.

### Tasks API (curl)

The public **one-time scheduled task** endpoint is `POST /api/tasks` (API key auth). In-product docs live under **Settings → API keys**.

**Prerequisites:** stack running; a workspace API key; an **authorized** WhatsApp connection with an attached agent (`senderPhone`); a recipient number.

```bash
# Helper script (pretty-prints request/response)
TASK_API_KEY=your_workspace_api_key \
SENDER_PHONE=+60123456789 \
RECIPIENT_PHONE=60198765432 \
./scripts/test-task-api.sh
```

Defaults: `TASK_API_URL=http://localhost:8080/api/tasks` (frontend nginx proxy). Hit the backend directly with `TASK_API_URL=http://localhost:3001/api/tasks`. Override schedule with `SCHEDULE_AT` (local datetime, no `Z`) and `TIMEZONE` (IANA, e.g. `Asia/Kuala_Lumpur`). Run `./scripts/test-task-api.sh --help` for all options.

Raw curl equivalent:

```bash
curl --request POST \
  --url http://localhost:8080/api/tasks \
  --header 'x-api-key: YOUR_WORKSPACE_API_KEY' \
  --header 'content-type: application/json' \
  --data '{
    "message": "Hello from API",
    "senderPhone": "+60123456789",
    "phoneNumber": "60198765432",
    "scheduleType": "one_time",
    "scheduleAt": "2026-12-31T23:00:00",
    "timezone": "Asia/Kuala_Lumpur"
  }'
```

Success: `{"ok":true,"id":"<task-uuid>"}`. Common errors: `invalid_api_key` (401), `sender_not_registered` / `sender_not_activated` / `sender_agent_not_attached` (422).

> **Deploying to production?** See [DEPLOYMENT.md](DEPLOYMENT.md) for production images, managed database, domain/HTTPS, and secrets.

## Architecture

```
Browser → frontend (nginx :8080)
              │
              ├─ /api/* → backend (Hono :3001)
              │              ├─ PostgreSQL (schema: database/migrations/)
              │              ├─ Cloudflare R2 (S3-compatible file storage)
              │              ├─ OpenRouter (AI)
              │              ├─ pg-boss (job queue, in-process)
              │              └─ Resend (email)
              │
              └─ static files (React SPA)

whatsapp / Baileys service (:3002 host) ←→ backend (canonical webhooks → backend; REST ← backend)
```

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React 19, React Router, Tailwind 4, shadcn / Base UI |
| Backend | Hono (Node), Drizzle ORM, PostgreSQL |
| Auth | JWT issued by backend (`backend/src/routes/auth.ts`, middleware) |
| Files | S3-compatible storage (MinIO / R2 / AWS) via `backend/src/lib/storage.ts` |
| Jobs | pg-boss, Resend, OpenRouter |

| Package | Role |
|---------|------|
| **`frontend/`** | Vite + React 19 SPA, React Router, Tailwind 4, shadcn/Base UI — talks to backend over HTTP (`frontend/src/lib/api.ts`) |
| **`backend/`** | Hono API on Node, Drizzle ORM → PostgreSQL, JWT auth, S3-compatible storage |
| **`whatsapp/`** | WhatsApp session manager (separate service) |
| **`database/`** | Drizzle SQL migrations (`database/migrations/`) and ops scripts (`database/scripts/`) |

# Senqo

WhatsApp business automation platform — AI agents, shared inbox, CRM, bulk messaging, and human handoff.

Senqo is an open-source, self-hosted platform that connects WhatsApp Business numbers to configurable AI agents. Teams get a shared inbox with manual takeover, reusable knowledge bases, scheduled messaging, and a full CRM.

## Get started

Everything runs in Docker — Postgres and the app in one command. File storage uses Cloudflare R2 (free tier; set up once).

### 1. Clone and configure

```bash
git clone https://github.com/your-org/senqo.git
cd senqo
cp .env.example .env
```

Use the repo-root `.env` only — Docker Compose reads it for variable substitution and service config. **Finish this entire step before `docker compose up`.**

**Production mode and HTTPS.** `.env.example` sets `NODE_ENV=production`. In that mode the backend only accepts browser API calls over **HTTPS** from origins listed in `ALLOWED_PRODUCTION_ORIGINS`. If you open `http://<vps-ip>:8080` from your laptop, the page may load but **login will silently fail** (CORS blocks the API; refresh cookies need `AUTH_COOKIE_SECURE=true` over HTTPS). Remote access needs the public-access vars below plus [Caddy in step 3](#3-expose-the-app-publicly-caddy).

Set at least:

- `JWT_SECRET` — `openssl rand -hex 32`; signs and verifies login access and refresh tokens
- `API_KEY_PEPPER` — `openssl rand -hex 32`; server-side pepper for hashing workspace API keys at rest (do not change after keys are issued)
- `WORKSPACE_SECRETS_KEY` — `openssl rand -hex 32`; encrypts workspace secrets used by custom agent tools
- `OPENROUTER_API_KEY` — [openrouter.ai](https://openrouter.ai) (AI agent; backend won't start without it)
- `RESEND_API_KEY` — [resend.com](https://resend.com) (registration invite email)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — object storage for media (see [Storage](#storage-cloudflare-r2) below)

**Instance auth (production VPS — set before first `docker compose up`):**

- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` — first superadmin (required when `ALLOW_PUBLIC_REGISTRATION=false`)
- `BOOTSTRAP_WORKSPACE_NAME` — optional initial workspace name
- `ALLOW_PUBLIC_REGISTRATION=false` — invite-only platform signup (toggle anytime from **Instance admin** on the Workspaces page)

**Public access** (required if anyone opens Senqo from another machine — replace `<VPS_PUBLIC_IP>` with your server's public IPv4):

- `FRONTEND_URL` — `https://<VPS_PUBLIC_IP>` (invite links and auth redirects)
- `AUTH_COOKIE_SECURE` — `true`
- `ALLOWED_PRODUCTION_ORIGINS` — `<VPS_PUBLIC_IP>` (hostname only, no `https://`)

Bundled Compose values (usually leave as in `.env.example`):

- `DB_PASSWORD` — Postgres password for the `postgres` service (Compose builds `DATABASE_URL` from it)
- `WHATSAPP_WEBHOOK_AUTHORIZATION` — shared secret for webhook `?token=` validation
- `WHATSAPP_SERVICE_API_KEY` — shared `x-api-key` between backend and `whatsapp` service

### Storage (Cloudflare R2)

The `S3_*` vars in step 1 point at an S3-compatible bucket. R2's free tier (10 GB) is enough to run Senqo. This section is only how to obtain the values (see `.env.example` for the variable names). The bucket stays private; Senqo serves files via presigned URLs.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage** → create a bucket (e.g. `senqo-wa`) → **`S3_BUCKET`**
2. R2 overview → copy **Account ID** → **`S3_ENDPOINT`** = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
3. **`S3_REGION`** — `auto`
4. **Manage R2 API Tokens** → token with **Object Read & Write** scoped to that bucket → **`S3_ACCESS_KEY`** (Access Key ID) and **`S3_SECRET_KEY`** (Secret Access Key)

### 2. Start

```bash
docker compose up -d --build
```

First start builds images, starts Postgres, applies Drizzle migrations (`database/migrations/`), then starts the app. Expect a minute or two on first run. Rebuild after code or dependency changes with the same command.

| Service | Port | Role |
|---------|------|------|
| `frontend` | 8080 | React SPA + nginx proxy to `/api` |
| `backend` | 3001 | Hono API |
| `whatsapp` | 3002 | Baileys session manager |
| `postgres` | 5432 | PostgreSQL |

### 3. Expose the app publicly (Caddy)

Caddy terminates HTTPS on the VPS and proxies to the `frontend` container on `127.0.0.1:8080`. The frontend nginx already proxies `/api` to the backend — you do **not** expose port 3001 publicly.

**1. Open port 443 on the host and cloud firewall**

On the VPS (Ubuntu/Debian with `ufw`):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Also allow inbound **TCP 443** in your provider's panel if you use one — e.g. Hetzner **Firewalls**, AWS **Security Groups**, GCP **VPC firewall rules**, DigitalOcean **Cloud Firewalls**. Without this, Caddy listens but the internet cannot reach it.

**2. Install Caddy**

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

**3. Configure the Caddyfile**

Public CAs (Let's Encrypt) do not issue certificates for bare IP addresses, so Caddy uses a self-signed cert (`tls internal`). The connection is still encrypted; the browser just cannot verify the issuer.

```bash
sudo tee /etc/caddy/Caddyfile <<'EOF'
https://<VPS_PUBLIC_IP> {
    tls internal
    reverse_proxy 127.0.0.1:8080
}
EOF
```

Replace `<VPS_PUBLIC_IP>` in the file, then reload:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

**4. Apply `.env` changes (if you edited public-access vars after step 2)**

`FRONTEND_URL` and related vars are read by the **backend** at runtime — no frontend image rebuild is needed:

```bash
docker compose up -d backend
```

**5. Browser TLS warning**

Open `https://<VPS_PUBLIC_IP>`. Chrome/Firefox show **"Your connection is not private"** because the certificate is self-signed. Click **Advanced**, then **Proceed to … (unsafe)** (wording varies by browser). You only do this once per browser profile; the session is still encrypted.

### 4. Open the app

```
https://<VPS_PUBLIC_IP>
```

Sign in as the bootstrap admin. Use **Instance admin** on the Workspaces page (`/admin`) to toggle public registration, manage users, and delete workspaces.

**Team workflow (registration off):**

1. **Invite to Senqo** — sends a platform signup link (account only; no workspace yet).
2. Teammate signs up → empty Workspaces page → may **Create workspace** or wait to be added.
3. **Add to workspace** (Settings → Team) — adds an existing Senqo user to your project.

Superadmins see and can enter all workspaces. Open **Connect** and scan the WhatsApp QR code to link a number.

On the VPS itself only, `http://127.0.0.1:8080` works for a quick smoke test without Caddy.

## Features

### Inbox & conversations

- Unified inbox — sidebar with search, filters (label, WhatsApp line, human-handling-only), and per-line routing
- Thread view — message history with infinite scroll, AI reasoning insights, timeline-style handoff markers
- Manual replies — compose text and media; outbound sends show delivery confirmation
- AI / Human toggle — per-conversation control over automated vs manual replies
- Conversation labels — apply workspace labels; filter inbox by label
- Delete conversation — permanently remove thread, messages, and AI history (CRM contact preserved)

### AI agents

- Agent profiles — create, rename, and archive configurable agents with custom behavior instructions
- Multi-model — powered by OpenRouter; plug in any supported LLM
- Inline saves — per-section save buttons when settings change; transient success feedback
- Operator insights — dashboard-only explanation of what grounded each AI reply
- Per-connection attach — bind an agent to a WhatsApp line; Inactive / Testing / Live modes
- Inbound processing — debounced AI runs per conversation; only text and images reach the model
- Custom tools — TypeScript modules in Tool Catalog; compiled on save, run in isolated-vm with SSRF-guarded `fetch`
- Workspace secrets — Settings → Secrets stores encrypted env values as `ctx.env` at tool runtime
- Built-in tools — platform tools (send WhatsApp, schedule tasks, handoff, labels, load skills) always on
- Demo tool — new workspaces get a seeded `get_weather` custom tool (Open-Meteo, no API key)

### Knowledge base (agent)

- Workspace context — structured factual snippets organized into groups
- Response templates — canned Q&A pairs used as authoritative replies
- Handoff topics — escalation definitions for when to transfer to a human
- Skills — markdown playbooks for specialized workflows
- Asset groups — sendable files (images, video, audio, documents) the agent reasons about
- Auto-assign labels — agent can classify conversations with workspace labels

### Contacts (CRM)

- Contact directory — paginated table with name, phone, notes/metadata
- Search & filters — by name, phone, additional info, test contacts only
- Add / delete — create contacts; cascading delete removes conversations and agent history
- Test contact toggle — mark contacts as Test for Testing AI mode

### WhatsApp connections

- Connection manager — cards per session with live status, display name, phone
- First-party Baileys — lightweight Node service on Baileys v7 (no headless browser)
- QR pairing — scan QR to link a number; sessions persist across restarts
- AI reply mode — per-connection: Inactive, Testing (test contacts only), or Live
- Activity sheet — recent connection/disconnection events
- LID resolution — WhatsApp privacy identifiers resolved to phone-number JIDs

### Scheduled tasks

- Task list — paginated table with status, search, and filters
- One-time schedules — local datetime + timezone, converted to UTC
- Targeting — one CRM contact, contactless batch, or via agent tools
- Manual stop — cancel active tasks; pending pg-boss jobs cancelled
- Public API — server-to-server `POST /api/tasks` with API key auth and host guard

### Team & settings

- Workspace profile — display name, storage usage breakdown, 10 GB default quota
- API keys — create, list, delete workspace API keys with optional expiry
- Workspace secrets — encrypted key/value pairs for custom tool `requiredEnv`
- Team management — invite platform signup, add existing users to a workspace, list members
- User profile — name fields; password change

## Local development

**Runtime:** Node.js **22.12+** (Docker images use `node:22-alpine`; match locally when running tests outside Docker).

Read **`AGENTS.md`** before contributing — it covers architecture rules, repository pattern, testing principles, and UI conventions.

### Dev stack (hot reload)

Bind-mounts source; `backend`, `frontend`, and `whatsapp` hot-reload (`tsx watch` / Vite):

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up
```

After editing `package.json` in a service, rebuild that service:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml build backend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d backend
```

### Repo layout

| Package | Role |
|---------|------|
| `frontend/` | Vite + React 19 SPA — talks to backend over HTTP (`frontend/src/lib/api.ts`) |
| `backend/` | Hono API, Drizzle ORM → PostgreSQL, JWT auth, S3 storage |
| `whatsapp/` | Baileys session manager (REST in, webhooks → backend) |
| `database/` | Drizzle SQL migrations (`database/migrations/`) and ops scripts |

WhatsApp sessions persist under `whatsapp/sessions/` (host bind mount, gitignored). Service logs: `whatsapp/logs/whatsapp.log`.

### Useful commands

```bash
npm run build              # backend + frontend production build

docker compose logs -f backend
docker compose up -d backend          # pick up .env changes (FRONTEND_URL, etc.; no frontend rebuild)
docker compose up -d --build          # rebuild production images
docker compose down -v                # reset DB volume (R2 untouched)
docker compose run --rm migrate       # run migrations manually

cd backend && npx drizzle-kit generate --name <tag>   # new migration after schema edit
```

### Testing

```bash
npm test                   # all packages (backend, frontend, whatsapp)
npm run test:backend
npm run test:frontend
npm run test:whatsapp
npm run test:e2e           # Playwright (~3 tests per feature spec in e2e/)
```

E2E defaults to port **5199** (`E2E_DEV_PORT`) or set `E2E_BASE_URL=http://localhost:8080` with Docker Compose.

Repository tests hit a real Postgres — start it first:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
cd backend && npm test
```

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React 19, React Router, Tailwind 4, Base UI |
| Backend | Hono (Node), Drizzle ORM, PostgreSQL |
| WhatsApp | First-party Baileys v7 service |
| Auth | JWT (access + refresh tokens) |
| Files | S3-compatible storage (R2, MinIO, AWS) |
| Jobs | pg-boss, Resend, OpenRouter |

```
Browser → frontend (nginx :8080)
              │
              ├─ /api/* → backend (Hono :3001)
              │              ├─ PostgreSQL
              │              ├─ Cloudflare R2 (S3-compatible)
              │              ├─ OpenRouter (AI)
              │              ├─ pg-boss (job queue, in-process)
              │              └─ Resend (email)
              │
              └─ static files (React SPA)

whatsapp / Baileys service (:3002) ←→ backend (webhooks → backend; REST ← backend)
```

## License

MIT

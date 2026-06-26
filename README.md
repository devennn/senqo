# Senqo

WhatsApp business automation platform — AI agents, shared inbox, CRM, bulk messaging, and human handoff.

Senqo is an open-source, self-hosted platform that connects WhatsApp Business numbers to configurable AI agents. Teams get a shared inbox with manual takeover, reusable knowledge bases, scheduled messaging, and a full CRM.

## Get started

Run everything with Docker. You need Cloudflare R2 for file storage (free tier).

### 1. Clone and configure

```bash
git clone https://github.com/devennn/senqo.git
cd senqo
cp .env.example .env
```

Open `.env` and fill it in. Do this before `docker compose up`.

**Secrets** — run `openssl rand -hex 32` five times and paste into:

- `JWT_SECRET`
- `API_KEY_PEPPER`
- `WORKSPACE_SECRETS_KEY`
- `WHATSAPP_SERVICE_API_KEY`
- `WHATSAPP_WEBHOOK_AUTHORIZATION`

**API keys:**

- `OPENROUTER_API_KEY` — get one at [openrouter.ai](https://openrouter.ai)
- `SMTP_*` — outbound email (invites, WhatsApp disconnect alerts); see `.env.example`
- `S3_*` — see [Storage](#storage-cloudflare-r2) below

**First admin login:**

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`

**If you use Senqo from another computer** — set `AUTH_COOKIE_SECURE=true` and match [step 3](#3-expose-the-app-publicly-caddy) (IP or domain):

- `FRONTEND_URL=https://<VPS_PUBLIC_IP>` or `https://<YOUR_DOMAIN>`
- `ALLOWED_PRODUCTION_ORIGINS=<VPS_PUBLIC_IP>` or `<YOUR_DOMAIN>` (hostname only, no `https://`)

### Storage (Cloudflare R2)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → create a bucket → set `S3_BUCKET`
2. Copy **Account ID** → set `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
3. Set `S3_REGION=auto`
4. Create an R2 API token → set `S3_ACCESS_KEY` and `S3_SECRET_KEY`

### 2. Start

```bash
docker compose up -d --build
```

First run takes a minute or two. Run the same command again after you change code.

| Service    | Port |
| ---------- | ---- |
| `frontend` | 8080 |
| `backend`  | 3001 |
| `whatsapp` | 3002 |
| `postgres` | 5432 |

### 3. Expose the app publicly (Caddy)

Skip this if you only use Senqo on the server itself (`http://127.0.0.1:8080`).

Caddy adds HTTPS so you can open Senqo from other computers.

**Open port 443** on the VPS and in your cloud provider's firewall (Hetzner, AWS, etc.):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 443/tcp
sudo ufw enable
```

**Install Caddy:**

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Pick one:

**Option A — IP address**

Replace `<VPS_PUBLIC_IP>` with your server IP.

1. In `.env`:
   - `FRONTEND_URL=https://<VPS_PUBLIC_IP>`
   - `ALLOWED_PRODUCTION_ORIGINS=<VPS_PUBLIC_IP>`
2. Write the Caddyfile:

```bash
sudo tee /etc/caddy/Caddyfile <<'EOF'
https://<VPS_PUBLIC_IP> {
    tls internal
    reverse_proxy 127.0.0.1:8080
}
EOF
```

3. Your browser may warn about the certificate. Click **Advanced** → **Proceed**. That's normal for an IP address.

**Option B — Domain name**

Replace `<YOUR_DOMAIN>` with something like `app.example.com`.

1. Point your domain's **A record** to your server IP.
2. In `.env`:
   - `FRONTEND_URL=https://<YOUR_DOMAIN>`
   - `ALLOWED_PRODUCTION_ORIGINS=<YOUR_DOMAIN>`
3. Write the Caddyfile:

```bash
sudo tee /etc/caddy/Caddyfile <<'EOF'
<YOUR_DOMAIN> {
    reverse_proxy 127.0.0.1:8080
}
EOF
```

4. Caddy gets a real certificate. No browser warning.

**After option A or B** — run once:

```bash
sudo systemctl reload caddy
docker compose up -d backend
```

### 4. Open the app

Go to `https://<VPS_PUBLIC_IP>` or `https://<YOUR_DOMAIN>` and log in with your bootstrap admin email and password.

**Add teammates** (when public signup is off):

1. Click **Invite to Senqo** — sends them a signup link
2. They sign up and create or join a workspace
3. Go to **Settings → Team** → **Add to workspace**

Go to **Connect** and scan the WhatsApp QR code to link a number.

See **[FEATURES.md](FEATURES.md)** for what Senqo can do.

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

| Package     | Role                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| `frontend/` | Vite + React 19 SPA — talks to backend over HTTP (`frontend/src/lib/api.ts`) |
| `backend/`  | Hono API, Drizzle ORM → PostgreSQL, JWT auth, S3 storage                     |
| `whatsapp/` | Baileys session manager (REST in, webhooks → backend)                        |
| `database/` | Drizzle SQL migrations (`database/migrations/`) and ops scripts              |

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

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | Vite, React 19, React Router, Tailwind 4, Base UI |
| Backend  | Hono (Node), Drizzle ORM, PostgreSQL              |
| WhatsApp | First-party Baileys v7 service                    |
| Auth     | JWT (access + refresh tokens)                     |
| Files    | S3-compatible storage (R2, MinIO, AWS)            |
| Jobs     | pg-boss, SMTP (nodemailer), OpenRouter            |

```
Browser → frontend (nginx :8080)
              │
              ├─ /api/* → backend (Hono :3001)
              │              ├─ PostgreSQL
              │              ├─ Cloudflare R2 (S3-compatible)
              │              ├─ OpenRouter (AI)
              │              ├─ pg-boss (job queue, in-process)
              │              └─ SMTP (email)
              │
              └─ static files (React SPA)

whatsapp / Baileys service (:3002) ←→ backend (webhooks → backend; REST ← backend)
```

## License

MIT

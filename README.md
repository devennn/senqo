# Senqo

WhatsApp business automation platform — AI agents, shared inbox, CRM, bulk messaging, and human handoff.

## What is Senqo?

Senqo is an open-source platform that connects your WhatsApp Business numbers to configurable AI agents. It gives teams a shared inbox with manual takeover, reusable knowledge bases, scheduled messaging, and a full CRM — all self-hosted.

## Features

### Inbox & Conversations

| Feature             | Description                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Unified inbox       | Sidebar of conversations with search, filters (label, WhatsApp line, human-handling-only), and per-line routing |
| Thread view         | Message history with infinite scroll, AI reasoning insights, timeline-style handoff markers                     |
| Manual replies      | Compose text and media messages; outbound sends show with delivery confirmation                                 |
| AI / Human toggle   | Per-conversation control over automated vs manual replies                                                       |
| Conversation labels | Apply workspace labels; filter inbox by label                                                                   |
| Delete conversation | Permanently remove thread, messages, and AI history (CRM contact preserved)                                     |

### AI Agents

| Feature               | Description                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent profiles        | Create, rename, and archive configurable AI agents with custom behavior instructions                                                                   |
| Multi-model           | Powered by OpenRouter — plug in any supported LLM                                                                                                      |
| Inline saves          | Per-section save buttons appear only when settings change; transient success feedback                                                                  |
| Operator insights     | Dashboard-only explanation of what grounded each AI reply (templates, context, skills, behavior)                                                       |
| Per-connection attach | Bind an agent to a specific WhatsApp line; Inactive / Testing / Live modes                                                                             |
| Inbound processing    | Debounced AI runs per conversation; only text and images reach the model (other media triggers human handoff)                                          |
| Custom tools          | Engineer-authored TypeScript modules in **Tool Catalog**; compiled on save, executed in an **isolated-vm** sandbox with bridged `fetch` (SSRF-guarded) |
| Workspace secrets     | **Settings → Secrets** stores encrypted env values injected as `ctx.env` at tool runtime (never exposed to the UI after save)                          |
| Built-in tools        | Platform tools (send WhatsApp, schedule tasks, handoff, labels, load skills) are always on and not shown in the UI                                     |
| Demo tool             | New workspaces get a seeded `get_weather` custom tool (Open-Meteo, no API key)                                                                         |

### Knowledge Base (Agent)

| Feature            | Description                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Workspace context  | Structured factual snippets organized into groups the agent references                     |
| Response templates | Canned Q&A pairs used as authoritative replies (exact wording, language-aware translation) |
| Handoff topics     | Escalation topic definitions teaching when and how to transfer to a human                  |
| Skills             | Markdown playbooks defining specialized workflows the agent can load and follow            |
| Asset groups       | Sendable files (images, video, audio, documents) with descriptions the agent reasons about |
| Auto-assign labels | Agent can classify conversations with workspace labels via tooling                         |

### Contacts (CRM)

| Feature             | Description                                                                      |
| ------------------- | -------------------------------------------------------------------------------- |
| Contact directory   | Paginated table with name, phone, notes/metadata                                 |
| Search & filters    | Filter by name, phone, "has additional info", "test contacts only"               |
| Add / delete        | Create single contacts; cascading delete removes conversations and agent history |
| Test contact toggle | Mark contacts as Test — used with Testing AI mode                                |

### WhatsApp Connections

| Feature             | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| Connection manager  | Cards for each WhatsApp session with live status, display name, phone |
| First-party Baileys | Lightweight Node service on Baileys v7 — no headless browser          |
| QR pairing          | Scan QR to link a WhatsApp number; sessions persist across restarts   |
| AI reply mode       | Per-connection: Inactive, Testing (test contacts only), or Live       |
| Activity sheet      | Recent connection/disconnection events for troubleshooting            |
| LID resolution      | WhatsApp privacy identifiers resolved to phone-number JIDs            |

### Scheduled Tasks

| Feature            | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| Task list          | Paginated table with status indicators, search, and filters         |
| One-time schedules | Local datetime + timezone, converted to UTC for execution           |
| Targeting          | Reach one CRM contact, contactless batch, or via agent tools        |
| Manual stop        | Cancel active tasks; pending pg-boss jobs cancelled                 |
| Public API         | Server-to-server `POST /api/tasks` with API key auth and host guard |

### Team & Settings

| Feature           | Description                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Workspace profile | Display name, storage usage breakdown (agent assets vs conversation media), 10 GB default quota |
| API keys          | Create, list, delete workspace API keys with optional expiry                                    |
| Workspace secrets | Encrypted key/value pairs for custom tool `requiredEnv` (create, rotate, delete)                |
| Team management   | List members; invite by email                                                                   |
| User profile      | Name fields; password change                                                                    |

### Infrastructure

| Area           | Detail                                                        |
| -------------- | ------------------------------------------------------------- |
| Auth           | JWT-based (access + refresh tokens), email sign-up/sign-in    |
| Database       | PostgreSQL via Drizzle ORM (`database/migrations/`)           |
| File storage   | S3-compatible (Cloudflare R2, MinIO, AWS S3) — presigned URLs |
| Message queues | pg-boss (Postgres-backed job queue)                           |
| Email          | Resend for team invites                                       |
| Realtime       | Server-Sent Events for live inbox updates                     |

## Tech Stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | Vite, React 19, React Router, Tailwind 4, Base UI |
| Backend  | Hono (Node), Drizzle ORM, PostgreSQL              |
| WhatsApp | First-party Baileys v7 service                    |
| AI       | OpenRouter (any LLM)                              |

## Architecture

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

## Quick Start

See [DEVELOPMENT.md](DEVELOPMENT.md) for Docker Compose setup, local development, and testing, and [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment.

```bash
git clone https://github.com/your-org/senqo.git
cd senqo
cp .env.example .env
# Fill in required env vars (see DEVELOPMENT.md)
docker compose up -d --build
# Open http://<your-ip>:8080
```

## License

MIT

Test cicd

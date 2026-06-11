# Features

## Inbox & conversations

- Unified inbox — sidebar with search, filters (label, WhatsApp line, human-handling-only), and per-line routing
- Thread view — message history with infinite scroll, AI reasoning insights, timeline-style handoff markers
- Manual replies — compose text and media; outbound sends show delivery confirmation
- AI / Human toggle — per-conversation control over automated vs manual replies
- Conversation labels — apply workspace labels; filter inbox by label
- Delete conversation — permanently remove thread, messages, and AI history (CRM contact preserved)

## AI agents

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

## Knowledge base (agent)

- Workspace context — structured factual snippets organized into groups
- Response templates — canned Q&A pairs used as authoritative replies
- Handoff topics — escalation definitions for when to transfer to a human
- Skills — markdown playbooks for specialized workflows
- Asset groups — sendable files (images, video, audio, documents) the agent reasons about
- Auto-assign labels — agent can classify conversations with workspace labels

## Contacts (CRM)

- Contact directory — paginated table with name, phone, notes/metadata
- Search & filters — by name, phone, additional info, test contacts only
- Add / delete — create contacts; cascading delete removes conversations and agent history
- Test contact toggle — mark contacts as Test for Testing AI mode

## WhatsApp connections

- Connection manager — cards per session with live status, display name, phone
- First-party Baileys — lightweight Node service on Baileys v7 (no headless browser)
- QR pairing — scan QR to link a number; sessions persist across restarts
- AI reply mode — per-connection: Inactive, Testing (test contacts only), or Live
- Activity sheet — recent connection/disconnection events
- LID resolution — WhatsApp privacy identifiers resolved to phone-number JIDs

## Scheduled tasks

- Task list — paginated table with status, search, and filters
- One-time schedules — local datetime + timezone, converted to UTC
- Targeting — one CRM contact, contactless batch, or via agent tools
- Manual stop — cancel active tasks; pending pg-boss jobs cancelled
- Public API — server-to-server `POST /api/tasks` with API key auth and host guard

## Team & settings

- Workspace profile — display name, storage usage breakdown, 10 GB default quota
- API keys — create, list, delete workspace API keys with optional expiry
- Workspace secrets — encrypted key/value pairs for custom tool `requiredEnv`
- Team management — invite platform signup, add existing users to a workspace, list members
- User profile — name fields; password change

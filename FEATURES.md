# Features

## Inbox & conversations

- Unified inbox — sidebar with search, filters (label, WhatsApp line, human-handling-only), and per-line routing
- Threads are per WhatsApp line — the same contact on two connected numbers is two conversations (pre-fix merged threads are left as-is)
- Thread view — message history with infinite scroll, AI reasoning insights, timeline-style handoff markers
- Manual replies — compose text and media; outbound sends show delivery confirmation
- AI / Human toggle — per-conversation control over automated vs manual replies
- Handoff WhatsApp notify — when a chat switches to human handling, chosen verified teammates get a WhatsApp alert with reason, customer phone, WhatsApp line, workspace, and a dashboard link to open the conversation
- Conversation labels — apply workspace labels; filter inbox by label
- Delete conversation — permanently remove thread, messages, and AI history (CRM contact preserved)

## Reports

- Agent performance — workspace summary and per-agent table for conversations handled, AI replies, handoffs, handoff rate, and chats still in human mode; handoff topics ranked by volume (query by From/To date; defaults to last 30 days)

## AI agents

- Agent profiles — create, rename, and archive configurable agents with custom behavior instructions
- Multi-model — powered by OpenRouter; plug in any supported LLM
- Inline saves — per-section save buttons when settings change; transient success feedback
- Operator insights — dashboard-only explanation of what grounded each AI reply
- Per-connection attach — bind an agent to one or more WhatsApp lines from Agent setup; Inactive / Testing / Live modes stay per connection
- Tasks — when an agent has multiple attached lines, pick which WhatsApp connection the task sends on
- Inbound processing — debounced AI runs per conversation; only text and images reach the model
- Custom tools — TypeScript modules in Tool Catalog; compiled on save, run in isolated-vm with SSRF-guarded `fetch`
- AI tool draft — on Create tool, Generate with AI (Execute code row) drafts name, description, required env, and execute code from pasted API examples or instructions; review before save
- Workspace secrets — Settings → Secrets stores encrypted env values as `ctx.env` at tool runtime
- Built-in tools — platform tools (schedule tasks, handoff, labels, load skills) always on; WhatsApp replies come from structured `messages` (up to 3 bubbles) sent by the runtime after the agent run
- Demo tool — new workspaces get a seeded `get_weather` custom tool (Open-Meteo, no API key)

## Knowledge base

- Knowledge page — top-level nav for authoring Context, Response templates, and Human handoff (Agent keeps Profile, Skill/Tool catalogs, and Assets)
- Import docs — Knowledge page action: pick an agent, upload PDF/CSV/Markdown, AI drafts context/skills/templates in one background job at a time, review when ready (accept/discard per group or item, add one-by-one or all accepted), then attach to that agent; reopen Import docs to continue
- Workspace context — structured factual snippets organized into groups (Knowledge → Context); list rows show entry count vs group limit; the editor shows last updated and which agents attach the group; groups older than 90 days show a may-be-outdated hint
- Response templates — canned Q&A pairs used as authoritative replies (Knowledge → Response templates); list rows show entry count vs group limit; editor shows last-updated / used-by / outdated hints
- Handoff topics — escalation definitions for when to transfer to a human (create/edit groups on Knowledge → Human handoff; attach groups to an agent on Profile → Attached knowledge → Topics that need a human so they are included in the agent prompt with entry ids for `handoff_to_human`; from a group, Handoff settings can also attach agents and choose notify people); list rows show topic count vs group limit; editor shows last-updated / used-by / outdated hints
- Handoff notify people — via the Handoff settings dialog on a topic group, pick one or more teammates with verified handoff phones for the selected agents; each gets an alert from the conversation’s WhatsApp line when they registered on that same line
- Skills — markdown playbooks for specialized workflows (Agent → Skill Catalog)
- Asset groups — sendable files (images, video, audio, documents) the agent reasons about (Agent → Assets; attach on Profile → Capability)
- Auto-assign labels — agent can classify conversations with workspace labels
- Agent attach — Profile → Attached knowledge selects context/template/handoff groups; Profile → Capability selects assets, tools, and skills

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
- Team — workspace owners add existing Senqo users to a workspace; unregistered emails are rejected with a clear error
- Handoff phone registration — owners (or the member themselves) register a personal WhatsApp number on Team per connected WhatsApp line, confirm with a dashboard OTP sent from that line only; the same personal number needs a separate registration for each line that should alert them
- User profile — name fields; password change

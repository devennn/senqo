# Agent Evals — Requirements & Plan

Concept UI already exists under `frontend/src/pages/dashboard/Evals.tsx` (mock data). This document is the **build plan** to replace mocks with real backend behavior.

## Goals

1. **Report from conversation** — Operator flags a bad (or notable) thread, describes what was wrong / what should have been said. A **separate eval Spec agent** turns that into a durable eval case (turns snapshot, expected reply, analysis, knowledge refs).
2. **Run eval** — Replay the case through the **same production agent loop** used for live WhatsApp (`runAgentSession` in `backend/src/agent/`). A **separate Judge agent** scores the result and writes run history + answer analysis (pass = green, fail = red).
3. **Isolation** — Spec and Judge live in **`backend/src/agent-evals/`**. Do **not** mix their prompts/tools into `backend/src/agent/`. The subject under test **reuses** `backend/src/agent/` unchanged (call `runAgentSession` with eval-scoped session / dry-run semantics).

## Non-goals (v1)

- Training / fine-tuning from evals
- Multi-agent suite CI gate in GitHub Actions (optional later)
- Editing “Why this reply” / sources by hand beyond what Spec agent drafts
- Running one eval against **all** agents (UI already scopes to one agent)

---

## Architecture

```
Inbox “Eval” report
        │
        ▼
┌─────────────────────┐
│ agent-evals/spec    │  Spec agent (new)
│ drafts eval case    │
└─────────┬───────────┘
          │ persist eval_cases (+ turns, expected, analysis)
          ▼
┌─────────────────────┐
│ Evals UI (per agent)│  review / edit turns / expected reply
└─────────┬───────────┘
          │ Run eval
          ▼
┌─────────────────────┐
│ backend/src/agent/  │  Subject: same ToolLoopAgent path as live chat
│ runAgentSession     │  (eval session; no WhatsApp send)
└─────────┬───────────┘
          │ actual reply + tool/knowledge traces
          ▼
┌─────────────────────┐
│ agent-evals/judge   │  Judge agent (new)
│ pass/fail + analysis│
└─────────┬───────────┘
          │ append eval_runs
          ▼
     Run history tab + Answer analysis (red/green)
```

### Package layout (backend)

```
backend/src/agent-evals/
  index.ts                 # public entry: draftEvalFromReport, runEvalCase
  spec/
    agent.ts               # Spec agent (structured output → eval draft)
    prompt.ts
    schema.ts              # Zod: title, turns, expectedReply, analysis, sources…
  judge/
    agent.ts               # Judge agent (structured output → pass/fail + analysis)
    prompt.ts
    schema.ts
  subject.ts               # Thin wrapper: call runAgentSession for eval replay
  types.ts
```

**Rules**

| Path | Responsibility |
|------|----------------|
| `backend/src/agent/` | Production conversation agent only |
| `backend/src/agent-evals/` | Spec + Judge only; may **import** `runAgentSession` / shared LLM helpers |
| `backend/src/repositories/evals.ts` | All DB access for evals (repository pattern + logging) |
| `backend/src/routes/evals.ts` | HTTP; Zod at boundary; auth + workspace |

Do **not** put Spec/Judge prompts inside `system-prompt.ts` or tools under `agent/tools/`.

---

## Flows

### 1) Report from conversation → Spec agent

**Trigger:** Inbox thread → **Eval** → operator provides:

- Answer analysis guidance (what was wrong / notable)
- Expected-reply guidance (what it should have said)

**Input to Spec agent**

- Snapshot of conversation messages (text + media refs) for the thread
- Operator guidance fields
- Workspace / agent context ids (which agent was on the line)
- Optional: operator AI reasoning / labels already on messages

**Spec agent output (structured)**

- `title`
- `turns[]` (role, content, media refs, optional `whyReply` + `sources[]`)
- `expectedReply` (golden text; operator can edit later)
- `answerAnalysis` (initial analysis; typically `answerCorrect: false` for reports)
- `agentConfigId` (subject agent)

**Persist** as `status: ready` (Not run until first Run). No Accept step.

### 2) Run eval → subject loop + Judge

**Trigger:** Evals list play button (one agent at a time).

**Steps**

1. Load eval case + attached agent config.
2. **Subject run** via `agent-evals/subject.ts` → `runAgentSession`:
   - Use an **eval-isolated session** (do not pollute the live customer WhatsApp session).
   - Feed prior turns as history / inbound as the last user turn(s) per product rules.
   - Prefer **no outbound WhatsApp** (extend or reuse `dryRun` / skip-send path already in agent runtime).
   - Capture: structured `messages` reply text, tool calls, and any grounding traces needed for Judge + “Why this reply” / sources.
3. **Judge agent** receives: conversation turns, expected reply, actual reply (+ optional traces).
4. Judge returns: `passed`, `answerAnalysis`, optional critique.
5. Append `eval_runs` row; update case `answerCorrect` / `answerAnalysis` for the dock (red/green).

**Hard requirement:** Subject inference must use the **same agent loop** as live conversations (`ToolLoopAgent` / `runAgentSession`), not a one-shot chat completion that bypasses tools/skills.

### 3) Manual create (already in UI)

Operator writes title + customer message + expected reply. No Spec agent required for v1 (optional later: Spec polish).

---

## Data model (Drizzle)

Workspace-scoped; IDs are UUIDs.

Suggested tables (names TBD in migration):

- **`eval_cases`**
  - `id`, `workspace_id`, `agent_config_id`
  - `title`, `source` (`manual` | `conversation` | `template` | `context`)
  - `status` (`draft` | `ready`)
  - `expected_reply`
  - `answer_analysis`, `answer_correct` (nullable bool)
  - `source_conversation_id` (nullable)
  - `turns` jsonb (or normalized `eval_case_turns` if preferred)
  - `created_at`, `updated_at`

- **`eval_runs`**
  - `id`, `eval_case_id`, `workspace_id`
  - `passed`, `actual_reply`, `answer_analysis` (nullable)
  - `subject_session_id` (nullable; eval session)
  - `ran_at`, `created_at`

Repositories: `backend/src/repositories/evals.ts` (+ co-located tests against real Postgres).

---

## API (sketch)

All under workspace auth + `X-Workspace-Id`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/user/evals?agentId=` | List cases for one agent (paginated) |
| `GET` | `/api/user/evals/:id` | Case + runs |
| `POST` | `/api/user/evals` | Manual create |
| `POST` | `/api/user/evals/from-conversation` | Report → Spec agent → ready case |
| `POST` | `/api/user/evals/from-template` | Spec drafts conversation from template; expected reply = template answer |
| `POST` | `/api/user/evals/from-context` | Spec drafts conversation from context fact; expected reply = fact body |
| `PUT` | `/api/user/evals/:id` | Update turns / expected / accept draft |
| `POST` | `/api/user/evals/:id/run` | Subject run + Judge → append run |
| `DELETE` | `/api/user/evals/:id` | Delete case |

Replace frontend `evals-mock.ts` with hooks → `api.ts` once routes exist.

---

## Frontend (already prototyped)

Keep current UX; wire to API:

- Sidebar **Evals** (per-agent filter; no “all agents”)
- List: select whole row; Run / Accept on row
- Detail: Conversation (left/right bubbles) + floating Edit → reorder editor
- Tabs: Conversation | Run history
- Dock: Expected reply (left, editable) + Answer analysis (right, red/green; label outside box)
- Inbox: **Eval** capture dialog → `from-conversation` (Spec gets agent profile/behavior + attached workspace context)
- Knowledge → Response templates: **Eval** on an entry → `from-template` (Spec drafts conversation with agent business context; expected reply from answer)
- Knowledge → Context: **Eval** on a fact → `from-context` (same Spec path; expected reply from body)
- Knowledge → Human handoff: **Eval** on a topic → `from-handoff` (Spec drafts conversation; expected action = `handoff` + topic entry id; Judge scores tool call, not reply text)

Update **`FEATURES.md`** when behavior ships.

---

## Testing

- Repository tests → real DB
- Route integration tests (`app.request`) for create / from-conversation / run
- Unit tests for Spec/Judge schema parsing (mock LLM at boundary)
- Subject: assert `runAgentSession` invoked (mock at boundary), not a parallel toy loop
- E2E (~3): open Evals; create manual; run shows history (mock LLM in e2e if needed)

---

## Open decisions (resolved)

1. **Eval session strategy** — ephemeral dry-run session id (`crypto.randomUUID`); no dedicated `eval_sessions` table. Subject passes `historyOverride` into `runAgentSession` (dryRun; no WhatsApp send / no agent_messages persist).
2. **How much history to replay** — all turns before the trailing contiguous user block as frozen history; trailing user turn(s) as inbound (same idea as live debounce batching).
3. **Media** — Spec/Judge text-only; subject may pass image `signedUrl`s from turn media like live multimodal.
4. **Models** — optional `EVAL_SPEC_MODEL` / `EVAL_JUDGE_MODEL`; fallback to chat LLM.
5. **Async** — sync HTTP for v1.

---

## Todo list

### Phase 0 — Spec freeze

- [x] Confirm open decisions (session, replay depth, models, sync vs job)
- [x] Align API shapes with current frontend `types/evals.ts`

### Phase 1 — Persistence

- [x] Drizzle schema + migration for `eval_cases` / `eval_runs`
- [x] `repositories/evals.ts` (+ logging, real-DB tests)
- [x] Seed/dev helpers optional

### Phase 2 — `agent-evals/` Spec agent

- [x] Scaffold `backend/src/agent-evals/` (no changes to production prompts in `agent/`)
- [x] Spec schema + prompt + `draftEvalFromReport`
- [x] Route `POST /evals/from-conversation`
- [x] Wire Inbox Eval dialog → API (drop mock create path for this flow)

### Phase 3 — Subject replay (shared agent loop)

- [x] `agent-evals/subject.ts` wraps `runAgentSession`
- [x] Eval-isolated session; suppress WhatsApp send
- [x] Map eval turns → history + inbound message(s)
- [x] Capture actual reply text (+ traces for Judge / UI insight fields)

### Phase 4 — `agent-evals/` Judge agent

- [x] Judge schema + prompt + `judgeEvalRun`
- [x] Route `POST /evals/:id/run` = subject → judge → persist run
- [x] Update case analysis color from judge `passed`

### Phase 5 — CRUD + UI wiring

- [x] List / get / put / delete routes
- [x] Replace `frontend/src/lib/evals-mock.ts` with real hooks + `api.ts`
- [x] Keep concept UX (edit conversation, dock, run history)
- [x] Update `FEATURES.md`

### Phase 6 — Quality

- [x] Repo + route tests; Spec/Judge schema tests
- [x] Playwright ~3 cases for Evals
- [x] `npm run build` clean

---

## Success criteria

- Reporting a conversation creates a **draft** eval whose fields clearly come from the **Spec agent**, not hand-waved mocks.
- **Run** executes the **same** `runAgentSession` path as live chats (tools/skills/knowledge), without sending WhatsApp.
- **Judge** (in `agent-evals/`) decides pass/fail and drives red/green analysis + run history.
- Production `backend/src/agent/` remains the only conversation runtime; Spec/Judge stay in `agent-evals/`.

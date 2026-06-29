# Testing Plan: Integration Test Regression Coverage

## Strategy

Three layers of integration tests — one per package. Each layer mocks at its own boundary.

| Package | Tool | Mock boundary | What it proves |
|---------|------|---------------|----------------|
| `frontend/` | Vitest + React Testing Library | `frontend/src/lib/api.ts` | Pages/components render correctly and call the right API |
| `backend/` | Vitest + `app.request()` | Repositories | Routes, middleware, and services behave correctly end-to-end |
| `whatsapp/` | Vitest | Baileys / WA connection | Service logic handles connection events and session state |

No Playwright. No real browser. No real database. Tests run in `< 60 s` per package.

---

## Checklist

### Already done
- [x] Delete 42 mock-based unit tests across `backend/`, `frontend/`, `whatsapp/`
- [x] Remove stale `test`, `test:backend`, `test:frontend`, `test:whatsapp` scripts from root `package.json`
- [x] Delete `e2e/senqo.spec.ts` sections 6.3–6.7 — smoke tests using `waitForTimeout(2000)` + `expect(url).toBeTruthy()` which can never fail

### Still to do

#### Frontend integration tests
- [x] `frontend/src/pages/auth/sign-up.test.tsx` (pre-existing)
- [x] `frontend/src/pages/auth/sign-in.test.tsx` (pre-existing)
- [x] `frontend/src/pages/WorkspaceChooser.test.tsx`
- [x] `frontend/src/pages/dashboard/Labels.test.tsx`
- [x] `frontend/src/pages/dashboard/Crm.test.tsx`
- [x] `frontend/src/pages/dashboard/Connect.test.tsx`
- [x] `frontend/src/pages/dashboard/Tasks.test.tsx`
- [x] `frontend/src/pages/settings/Profile.test.tsx`
- [x] `frontend/src/pages/settings/Workspace.test.tsx`
- [x] `frontend/src/pages/settings/ApiKeys.test.tsx`
- [x] `frontend/src/pages/settings/Secrets.test.tsx`

#### Backend integration tests
- [x] `backend/src/routes/auth.integration.test.ts` (pre-existing — register, login, refresh, logout)
- [x] `backend/src/routes/user.test.ts` — workspaces, labels, contacts, conversations, tasks, connections, secrets, api-keys, profile, agents

#### WhatsApp integration tests
- [x] `whatsapp/src/session-manager.test.ts` (pre-existing)
- [x] `whatsapp/src/connection-events.test.ts`

#### Verify
- [x] `cd frontend && npm test` — 125 tests pass
- [x] `cd backend && npm test` — 221 tests pass
- [x] `cd whatsapp && npm test` — 59 tests pass
- [x] `npm run build` — no type errors

---

## What to keep (pure-logic unit tests — unchanged)

| File | Tests |
|------|-------|
| `backend/src/lib/auth-jwt.test.ts` | JWT sign/verify, tamper/expiry |
| `backend/src/lib/auth-cookie.test.ts` | Cookie logic |
| `backend/src/lib/auth-jwt-secret-missing.test.ts` | Missing env error |
| `backend/src/lib/pagination.test.ts` | Offset/page math |
| `backend/src/lib/json-schema-to-zod.test.ts` | Schema transformation |
| `backend/src/lib/workspace-secrets-crypto.test.ts` | Encryption/decryption |
| `backend/src/lib/whatsapp-jid.test.ts` | JID string logic |
| `backend/src/lib/app-version.test.ts` | Version comparison |
| `backend/src/lib/conversation-thread-events.test.ts` | Event generation |
| `backend/src/lib/public-api-host.test.ts` | Host config |
| `backend/src/lib/infer-custom-tool-input-schema.test.ts` | Schema inference |
| `backend/src/lib/realtime-bus.test.ts` | Event bus |
| `backend/src/lib/api-keys.test.ts` | Crypto key generation |
| `whatsapp/src/jid.test.ts` | JID classification/resolution |
| `whatsapp/src/message-dedupe.test.ts` | Deduplication |
| `frontend/src/lib/api.test.ts` | Auth headers, 401 refresh, FormData |
| `frontend/src/lib/auth-client.test.ts` | Token localStorage |
| `frontend/src/lib/active-workspace.test.ts` | Workspace localStorage |
| `frontend/src/lib/custom-tool-test-input.test.ts` | Test input normalization |
| `frontend/src/lib/public-tasks-api.test.ts` | Public tasks API |
| `frontend/src/hooks/useTransientBooleanReset.test.ts` | Timer auto-reset |
| `frontend/src/hooks/useAgentConfigFormDirty.test.ts` | Form dirty tracking |
| `frontend/src/components/ui/spinner.test.tsx` | ARIA accessibility |
| `frontend/src/components/ui/inline-help-hint.test.tsx` | Click-to-show tooltip |
| `frontend/src/pages/dashboard/components/table-pagination.test.tsx` | Page info + buttons |

---

## Frontend integration tests

**Pattern:** `vi.mock('@/lib/api')` → render the page → assert what the user sees.

Mock shape: spy on the named export functions in `api.ts` and return canned responses. Never mock React Router or hooks — let them run.

### Auth — `frontend/src/pages/auth/sign-up.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Sign-up form submits and redirects | Mock `signUp` → `{ ok: true }` | Form renders; fill email + password → submit → navigate to `/` |
| 2 | Submit button disabled until fields filled | No mock needed | Button disabled with empty inputs; enabled after both filled |
| 3 | API error shows inline message | Mock `signUp` → `{ ok: false, error: "Email already in use" }` | Error text visible after submit |

### Auth — `frontend/src/pages/auth/sign-in.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Sign-in submits and navigates to workspace chooser | Mock `signIn` → `{ ok: true }` | Fill email + password → submit → navigate to `/` |
| 2 | Wrong credentials shows error | Mock `signIn` → `{ ok: false, error: "Invalid credentials" }` | Error message visible |

### Workspace — `frontend/src/pages/workspace/workspace-chooser.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Workspace list renders | Mock `getWorkspaces` → 2 workspaces | Both workspace names visible |
| 2 | Clicking workspace navigates to dashboard | Mock `getWorkspaces` → 1 workspace | Click card → navigate to `/:workspaceId/dashboard` |
| 3 | Create workspace dialog — disabled until name filled | Mock `createWorkspace` → `{ ok: true }` | "Create" button disabled with empty name; enabled after filling |
| 4 | Create workspace submits and navigates | Mock `createWorkspace` → new workspace | Fill name → submit → navigate to new workspace dashboard |
| 5 | Search filters visible workspace list | Mock `getWorkspaces` → 2 workspaces | Type non-matching query → one workspace disappears |

### Dashboard — `frontend/src/pages/dashboard/dashboard.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Conversation list renders | Mock `getConversations` → 2 items | Both conversation rows visible |
| 2 | Filters panel toggles open/closed | Mock data | Filters button click → panel expands/collapses |
| 3 | Label filter updates URL param | Mock labels → 1 label | Change label select → URL contains `labelId=` |
| 4 | Search input writes debounced `?q=` to URL | — | Type in search → URL contains `q=` after debounce |
| 5 | Active filter badge increments | — | Apply 2 filters → badge shows "2" |
| 6 | Selecting conversation shows message thread | Mock `getMessages` → messages | Click conversation row → messages visible |
| 7 | Manage labels dialog opens | Mock labels | Click "Manage labels" → dialog visible with checkboxes |

### Labels — `frontend/src/pages/labels/labels.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Labels list renders | Mock `getLabels` → 1 label | Label name "Support" visible |
| 2 | Create label — disabled until name filled | Mock `createLabel` | "Create" button disabled; enabled after filling name |
| 3 | Create label submits and appears in list | Mock `createLabel` → new label | Fill "VIP" → submit → "VIP" row visible |
| 4 | Delete label opens confirmation and removes row | Mock `deleteLabel` → `{ ok: true }` | Click delete → confirm → row removed |

### Agent — `frontend/src/pages/agent/agent.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | All 7 tabs render in tab bar | Mock `getAgent` → agent object | "Profile", "Context", "Skill Catalog", "Tool Catalog", "Response templates", "Human handoff", "Assets" tabs visible |
| 2 | Profile tab — Save disabled until dirty | Mock agent data | Name input loads with current value; Save button disabled; change name → Save enabled |
| 3 | Context tab renders workspace context section | Mock context data | Navigate `?tab=context` → "Workspace context" heading visible |
| 4 | Human handoff tab renders topics section | Mock handoff data | Navigate `?tab=handoff` → handoff section visible |

### CRM — `frontend/src/pages/crm/crm.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Contact table renders rows | Mock `getContacts` → 2 contacts | Contact names and phones visible |
| 2 | Empty state when no contacts | Mock `getContacts` → `[]` | Empty state text visible |
| 3 | Pagination controls render | Mock returns `total: 25, page: 1, pageSize: 10` | "Showing 1–10 of 25" visible; Next enabled; Previous disabled |

### WhatsApp connections — `frontend/src/pages/connect/connect.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Connections page renders | Mock `getConnections` → 1 connection | Connection name visible; "Add connection" button visible |
| 2 | Empty state | Mock `getConnections` → `[]` | Empty state or "Add connection" CTA visible |

### Tasks — `frontend/src/pages/tasks/tasks.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Tasks page renders | Mock `getTasks` → 2 tasks | Task rows visible |
| 2 | Empty task list | Mock `getTasks` → `{ items: [] }` | Empty state visible |

### Settings — `frontend/src/pages/settings/profile.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Profile page renders personal info fields | Mock `getProfile` → user object | First name, last name inputs visible; email displayed |
| 2 | Save disabled until dirty | Mock profile data | Button disabled initially; change first name → button enabled |
| 3 | Password section — Update disabled until valid | — | Disabled until both fields filled and matching |

### Settings — `frontend/src/pages/settings/workspace.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Workspace page renders | Mock workspace data | Storage section, workspace name input visible |
| 2 | Save disabled until name changes | Mock workspace | Button disabled; edit name → button enabled |

### Settings — `frontend/src/pages/settings/api.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Two tabs visible | — | "How to use API" and "API keys" tabs visible |
| 2 | How to use API tab shows endpoint | — | `POST` endpoint text and "Copy curl" button visible |
| 3 | Create API key — disabled until label filled | Mock `createApiKey` | Button disabled; fill label → enabled |
| 4 | Created key displayed once | Mock `createApiKey` → key string | Success banner visible; key code block visible |

### Settings — `frontend/src/pages/settings/secrets.test.tsx`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Existing secret visible | Mock `getSecrets` → 1 secret | Secret name visible in monospace |
| 2 | Create secret — disabled until both fields filled | Mock `createSecret` | Button disabled; fill name + value → enabled |
| 3 | Delete secret removes row | Mock `deleteSecret` → `{ ok: true }` | Click Delete → confirm → row removed |

---

## Backend integration tests

**Pattern:** `app.request(method, path, body, headers)` → assert status code + JSON body. Mock repositories with `vi.mock('../repositories/...')`.

Auth header: include `Authorization: Bearer <signed-test-JWT>` for protected routes. Use `X-Workspace-Id` header for workspace-scoped routes.

### Auth — `backend/src/routes/auth.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | Sign up creates user and returns token | `userRepository.create` → new user | `POST /api/auth/sign-up` valid payload | 201; `Set-Cookie` contains JWT |
| 2 | Sign up — duplicate email returns 409 | `userRepository.create` → conflict error | `POST /api/auth/sign-up` existing email | 409; `{ error: "..." }` |
| 3 | Sign up — missing fields returns 400 | No mock needed | `POST /api/auth/sign-up` empty body | 400; validation error |
| 4 (happy path) | Sign in with correct credentials returns token | `userRepository.findByEmail` → user; password matches | `POST /api/auth/sign-in` valid credentials | 200; `Set-Cookie` contains JWT |
| 5 | Sign in — wrong password returns 401 | `userRepository.findByEmail` → user; password fails | `POST /api/auth/sign-in` wrong password | 401 |
| 6 | Sign in — unknown email returns 401 | `userRepository.findByEmail` → null | `POST /api/auth/sign-in` unknown email | 401 |
| 7 (happy path) | `GET /api/auth/session` returns user when authenticated | `userRepository.findById` → user | Valid JWT cookie | 200; user object |
| 8 | `GET /api/auth/session` returns 401 without token | No mock | No auth header | 401 |

### Workspaces — `backend/src/routes/workspaces.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | List workspaces | `workspaceRepository.listByUser` → 2 workspaces | `GET /api/user/workspaces` | 200; array of 2 |
| 2 (happy path) | Create workspace | `workspaceRepository.create` → new workspace | `POST /api/user/workspaces` `{ name: "Test" }` | 201; workspace object |
| 3 | Create workspace — missing name returns 400 | No mock | `POST /api/user/workspaces` `{}` | 400 |
| 4 | Unauthenticated request returns 401 | No mock | `GET /api/user/workspaces` no token | 401 |

### Conversations — `backend/src/routes/conversations.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | List conversations | `conversationRepository.list` → 2 items | `GET /api/user/conversations` | 200; paginated result |
| 2 | Label filter narrows results | `conversationRepository.list` called with `labelId` | `GET /api/user/conversations?labelId=lbl-1` | 200; repository called with correct filter |
| 3 | Get conversation messages | `messageRepository.list` → messages | `GET /api/user/conversations/:id/messages` | 200; array |
| 4 | Wrong workspace scope returns 403 | `workspaceRepository.membership` → not member | Request with mismatched `X-Workspace-Id` | 403 |

### Labels — `backend/src/routes/labels.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | List labels | `labelRepository.list` → 2 labels | `GET /api/user/conversation-labels` | 200; array |
| 2 (happy path) | Create label | `labelRepository.create` → new label | `POST /api/user/conversation-labels` `{ name: "VIP" }` | 201; label object |
| 3 | Create label — missing name returns 400 | No mock | `POST` empty body | 400 |
| 4 (happy path) | Delete label | `labelRepository.delete` → ok | `DELETE /api/user/conversation-labels/:id` | 200 |
| 5 | Delete label not found returns 404 | `labelRepository.delete` → not found | `DELETE` unknown id | 404 |

### Agents — `backend/src/routes/agents.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | Get agent | `agentRepository.findById` → agent | `GET /api/user/agents/:id` | 200; agent object |
| 2 (happy path) | Update agent profile | `agentRepository.update` → updated | `PUT /api/user/agents/:id` `{ profile_name: "..." }` | 200; updated agent |
| 3 | Get agent — wrong workspace returns 403 | scope check fails | Request with wrong `X-Workspace-Id` | 403 |

### Contacts — `backend/src/routes/contacts.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | List contacts paginated | `contactRepository.list` → `{ items: [...], total: 25 }` | `GET /api/user/contacts` | 200; `{ items, total, page, pageSize }` |
| 2 | Page param forwarded to repository | `contactRepository.list` spy | `GET /api/user/contacts?page=2` | Repository called with `page: 2` |
| 3 | Unauthenticated returns 401 | No mock | No auth token | 401 |

### Connections — `backend/src/routes/connections.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | List connections | `connectionRepository.list` → 1 connection | `GET /api/user/connections` | 200; array |
| 2 (happy path) | Delete connection | `connectionRepository.delete` → ok | `DELETE /api/user/connections/:id` | 200 |
| 3 | Delete connection — not found returns 404 | `connectionRepository.delete` → not found | `DELETE` unknown id | 404 |

### Tasks — `backend/src/routes/tasks.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | List tasks | `taskRepository.list` → 2 tasks | `GET /api/user/tasks` | 200; paginated result |
| 2 | Empty list | `taskRepository.list` → `{ items: [], total: 0 }` | `GET /api/user/tasks` | 200; empty items |

### Settings — `backend/src/routes/settings.test.ts`

| # | Test | Mock | Request | Assert |
|---|------|------|---------|--------|
| 1 (happy path) | Get profile | `userRepository.findById` → user | `GET /api/user/profile` | 200; profile object |
| 2 (happy path) | Update profile | `userRepository.update` → updated | `PUT /api/user/profile` `{ firstName: "..." }` | 200 |
| 3 | Create API key — missing label returns 400 | No mock | `POST /api/user/api-keys` empty body | 400 |
| 4 (happy path) | Create secret | `secretRepository.create` → new secret | `POST /api/user/secrets` valid body | 201; secret object (value shown once) |
| 5 (happy path) | Delete secret | `secretRepository.delete` → ok | `DELETE /api/user/secrets/:id` | 200 |

---

## WhatsApp integration tests

**Pattern:** Construct the service/session class with mocked Baileys socket → trigger events → assert state or emitted events.

### Session — `whatsapp/src/session.test.ts`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Session initializes and registers connection handler | Mock Baileys socket | Connection update event listener registered; initial state is "connecting" |
| 2 | `connection: open` event transitions state to connected | Emit `connection: open` | Session state becomes "connected" |
| 3 | `connection: close` event triggers reconnect logic | Emit `connection: close` with reconnect reason | Reconnect attempted; state becomes "reconnecting" |
| 4 | `connection: close` with logout reason clears session | Emit close with logout reason | Session credentials cleared; no reconnect |

### Connection events — `whatsapp/src/connection-events.test.ts`

| # | Test | Setup | What to assert |
|---|------|-------|----------------|
| 1 (happy path) | Incoming message event is forwarded to backend | Mock HTTP client to backend | Receive WA message event → `POST /internal/message` called with correct payload |
| 2 | Message deduplication blocks duplicate | Two identical message events | Backend called only once |
| 3 | QR code event emitted to waiting client | Mock QR subscriber | Receive QR event → subscriber receives QR string |

---

## How to run

```bash
# Backend integration tests
cd backend && npm test

# Frontend integration tests
cd frontend && npm test

# WhatsApp integration tests
cd whatsapp && npm test

# All packages from root
npm test --workspaces

# Watch mode (any package)
cd backend && npm run test:watch
```

Tests run with Vitest. No browser, no Docker, no database required. Each package is self-contained.

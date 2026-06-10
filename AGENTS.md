# AGENTS.md

Canonical agent instructions for this repo. **`CLAUDE.md`** and **`.cursor/rules/agents.mdc`** point here; read the relevant section before changing that area.

## Quick commands

```bash
npm run build          # backend + frontend
```

Run the stack: see root `README.md` (`docker compose up -d`).

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite, React 19, React Router, Tailwind 4, shadcn / Base UI |
| Backend | Hono (Node), Drizzle ORM, PostgreSQL |
| Auth | JWT issued by backend (`backend/src/routes/auth.ts`, middleware) |
| Files | S3-compatible storage (MinIO / R2 / AWS) via `backend/src/lib/storage.ts` |
| Jobs | pg-boss, Resend, OpenRouter (see `README.md`) |

| Package | Role |
|---------|------|
| **`frontend/`** | Vite + React 19 SPA, React Router, Tailwind 4, shadcn/Base UI — talks to backend over HTTP (`frontend/src/lib/api.ts`) |
| **`backend/`** | Hono API on Node, Drizzle ORM → PostgreSQL, JWT auth, S3-compatible storage |
| **`whatsapp/`** | WhatsApp session manager (separate service) |
| **`database/`** | Drizzle SQL migrations (`database/migrations/`) and ops scripts (`database/scripts/`) |

**Out of scope for new work:** Next.js, Supabase JS client, server components, server actions.

**Not in use:** Next.js App Router, Supabase client in app code, or a root-level `landing/` app (removed from the tree).

---

# Production rules

## Design

- Customer-facing UI follows **`DESIGN.md`** (see [Design system](#design-system-source-of-truth)). Tokens live in **`frontend/src/globals.css`**.

## Architecture (strict)

### 1. Repository pattern (backend only)

All **database** access lives in **`backend/src/repositories/`**.

- **Frontend** must never query Postgres or call Drizzle.
- **Services** (`backend/src/services/`) must not use Drizzle directly — go through repositories.
- Repositories use **`backend/src/db/index.ts`** (Drizzle) and schema under **`backend/src/db/schema/`**.

### 2. Repository logging + error handling

Every repository function must:

- Use try/catch
- Log success, expected failure, and unexpected failure

#### Log format

**Success:** `[SettingsRepository/updateProfile] Success: userId=123`

**Expected failure:** `[SettingsRepository/updateProfile] Failed query: <message>`

**Unexpected (mandatory):** `[SettingsRepository/updateProfile] Unexpected error: <message>`

### 3. Database migrations

- Schema is defined in **`backend/src/db/schema/`**.
- **Drizzle** migrations live in **`database/migrations/`** (generate with `drizzle-kit` from `backend/drizzle.config.ts`).
- Add a **new** migration file per change; do not edit applied migration SQL in place.
- **`database/scripts/`** holds optional ops SQL (e.g. owner setup); schema changes go through Drizzle only.
- No manual production schema changes outside migrations.

### 4. Frontend UI layout

Feature UI belongs under:

```
frontend/src/pages/<feature>/components/
```

Examples: `pages/dashboard/components/`, `pages/settings/components/`.

Rules:

- UI stays **presentational** — no business rules buried in JSX.
- UI must **not** import repositories.
- Data and mutations go through **hooks** (`frontend/src/hooks/`) and **`frontend/src/lib/api.ts`**.

### 5. Component size

- Max **150 lines** per component; split when responsibilities diverge.

### 6. Data flow

```
Browser → frontend hook → lib/api.ts → Hono route → service (optional) → repository → Postgres
```

Forbidden:

- Frontend → database
- Route handler → inline SQL (use repositories)

### 7. React (SPA)

- Functional components only; no side effects in render.
- Hooks: `use*` prefix, single responsibility, full dependency arrays when using `useEffect`.
- Prefer hooks + `api.ts` for server state; avoid `useEffect` for initial fetch when a dedicated hook already exists.
- State priority: local state → derived state → context.

### 8. Backend API

- Routes in **`backend/src/routes/`**; mount in **`backend/src/index.ts`**.
- Validate input (e.g. Zod) at the route boundary.
- Enforce auth via **`backend/src/middleware/auth.ts`** and workspace scope via **`X-Workspace-Id`** where applicable.
- Never expose DB credentials or S3 secrets to the frontend.

### 9. Code style

- TypeScript strict; avoid `any`.
- **Frontend** imports: `@/*` → `frontend/src/*`.
- **Backend** imports: relative paths under `backend/src/`.
- No dead code (unused imports, files, commented legacy blocks).
- Prefer explicit return types on repository functions.

### 10. Folder ownership

| Path | Responsibility |
|------|----------------|
| `frontend/src/pages/**` | Routes and feature UI |
| `frontend/src/components/ui` | shadcn primitives only |
| `frontend/src/hooks` | React data/orchestration |
| `frontend/src/lib` | API client, auth client, utilities |
| `backend/src/routes` | HTTP handlers |
| `backend/src/services` | Business logic |
| `backend/src/repositories` | All DB access |
| `backend/src/agent` | Agent runtime, tools, prompts |
| `database/migrations` | Drizzle SQL migrations |

### 11. Types

- **`backend/src/types/`** — server/domain/API types.
- **`frontend/src/types/`** — UI and client API shapes.
- Do not add a repo-root `/types` folder or per-feature `types/` subtrees under `pages/`.
- Keep shared API shapes aligned with backend responses when both sides model the same contract.

### 12. UI primitive API safety

- Validate `components/ui/*` APIs before use (Base UI, not Radix legacy).
- **`Button`** does not support `asChild`; use `render` or `buttonVariants` on `Link`/`a`.
- For uncontrolled inputs (`defaultValue`), remount with a stable `key` when switching entities.

### 13. Testability

**Infrastructure:** Vitest in all three packages (`backend/`, `frontend/`, `whatsapp/`). Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`. Root: `"test": "npm run test --workspaces"`.

#### Principles

| # | Principle | What it means |
|---|-----------|---------------|
| 1 | **Co-locate tests with source** | `repositories/contacts.ts` → `repositories/contacts.test.ts`. No separate `__tests__/` tree. If you see a file without a neighbour test, coverage is missing. |
| 2 | **Test behaviour, not implementation** | Assert what the function returns or the component renders. Never assert internal variable values, private method calls, or line counts. If you refactor internals, tests should still pass. |
| 3 | **Mock at the boundary** | For unit tests: mock `db` (Drizzle). For component tests: mock `api` (the HTTP client). For integration tests: mock nothing — hit a real DB. Don't mock Drizzle internals, don't mock React hooks internals. |
| 4 | **One concept per test** | Each `it(...)` verifies one behaviour under one condition. If you need "and" in the test name, split it. This makes failures instantly diagnosable. |
| 5 | **Test error paths as thoroughly as happy paths** | Repos return `{ ok: false }` — test it. Middleware returns 401/403 — test it. API returns validation errors — test it. Bugs cluster in error handling. |
| 6 | **Repository tests hit a real DB** | Mocking SQL rows misses schema mismatches, constraint violations, and query bugs. Every repo `*.test.ts` talks to a real Postgres (Docker). Fast unit-level mocks only for pure-logic files (auth-jwt, pagination, dedupe). |
| 7 | **Route tests are integration tests** | Don't unit-test a Hono handler by calling the function. Use `app.request()` to send a real HTTP request through middleware → route → repo → DB. Verify the JSON response and status code. |
| 8 | **Frontend tests render, don't inspect** | Use `render(<Component />)` and assert what the user sees (`screen.getByText(...)`, `screen.getByRole(...)`). Never assert state variables, hook internals, or component instance methods. |
| 9 | **No snapshot tests** | Snapshots are high-noise, low-signal. A one-pixel shift or a comma change breaks them. Prefer explicit assertions on the specific thing you care about. |
| 10 | **Fast feedback loop** | Unit/hook tests complete in < 10 seconds so they can run on save. Integration tests complete in < 60 seconds so they can run pre-push. E2E runs in CI only. |
| 11 | **Descriptive test names** | Pattern: `[subject] → [behaviour] under [condition]`. Example: `listContactsPage → returns only test contacts when testOnly filter is true`. Don't name tests `should work` or `test 1`. |
| 12 | **No coverage thresholds** | Quality over quantity. A 95% line count with weak assertions is worse than 70% with strong behavioural coverage. Review what's untested in PRs manually, don't gate on a number. |
| 13 | **Test from the outside in** | API tests assert the JSON a real client receives. Component tests assert the DOM a real user sees. Hook tests assert the data a real component would get. Never tunnel into internals to set up or verify state. |
| 14 | **Don't test framework/library code** | Don't test that Drizzle inserts rows correctly, that Hono parses headers, that React re-renders on state change, or that Baileys connects to WhatsApp. Trust the library. Test _your_ logic on top of it. |
| 15 | **E2E: ~3 tests per feature** | Each Playwright spec in `e2e/` targets one feature with **about three tests**: at least one **happy path**, the rest for **critical user-visible behaviour** only. See [E2E (Playwright)](#e2e-playwright) below. |
| 16 | **Large features: E2E first** | For multi-file or cross-layer work, **start with failing Playwright tests** that describe the intended user flow, then implement until they pass. See [E2E (Playwright)](#e2e-playwright) below. |

#### E2E (Playwright)

Playwright specs live in **`e2e/`**. Run with **`npm run test:e2e`** (see `DEVELOPMENT.md` for port / `E2E_BASE_URL`).

**Large features — outside-in workflow:**

1. Add a new spec (or extend an existing one) with **~3 failing tests** — happy path plus critical behaviour.
2. Run E2E locally and confirm they **fail for the right reason** (missing UI, wrong state), not flaky setup.
3. Implement frontend, API, and persistence **until the spec passes**; add unit/integration tests at boundaries as you go.
4. Keep mocks minimal — prefer routing real stack paths when the feature needs them; mock only what the E2E does not exercise.

- **~3 tests per feature spec** — not a broad smoke suite.
- **At least one happy path** — the user completes the main flow successfully.
- **Remaining tests** — **critical behaviour only** (e.g. save disabled until dirty, validation errors users actually hit). Do not add E2E cases that duplicate unit coverage without user-visible value.
- Assert what the **user sees** in the DOM (`getByRole`, labels, visible text). Mock API at the HTTP boundary (`page.route`) when not hitting a real stack.
- Do not use **`waitForTimeout`** as the primary wait — use `expect`, `waitForURL`, or role/label locators.

Example: `e2e/custom-tools.spec.ts`.

#### Quality gates (enforcement)

**A. PR review checklist (the real gate)** — every PR touching a `.ts`/`.tsx` file must pass:

| Check | Look for |
|-------|----------|
| **Does the test fail when the code is wrong?** | Comment out the line being tested — the test must fail. If it still passes, the test is worthless. |
| **Are assertions specific?** | Not `expect(result).toBeDefined()`. Must assert the actual value: `expect(payload.error).toBe("invalid_api_key")`. |
| **Are error paths covered?** | If the source has `try/catch`, `if (!x) return {}`, or `safeParse` — there must be a test exercising the failure branch. |
| **Mock count is low** | More than 2 mocks in a unit test? The function is too coupled — refactor before testing. |
| **No implementation assertions** | `expect(fn).toHaveBeenCalledTimes(3)` is a red flag. Assert the output, not the call count. |
| **Integration tests exist for routes** | Every new `app.get/post/put/delete` in `routes/` needs at least one `app.request()` test that hits a real DB. |

**B. Ban anti-pattern tests (lint-level)** — add to eslint config:

```ts
"no-restricted-properties": [
  "error",
  { "object": "expect", "property": "toMatchSnapshot" },  // never
  { "object": "expect", "property": "toBeDefined" },       // too weak
  { "object": "expect", "property": "not.toBeNull" },      // same
]
```

**C. Mutation testing (periodic, not per-PR)** — run Stryker monthly:

```bash
npx stryker run --mutate "backend/src/repositories/**/*.ts" "backend/src/agent/**/*.ts"
```

**D. Review the test file first** — during PR review, read the `*.test.ts` before the source. If you can't understand what the code does from the test descriptions, the descriptions are bad. If every test only hits the happy path, send it back.

**E. No `it.todo` / `test.skip` in merged code** — either write the test or delete the placeholder. CI step: `! grep -r "it.todo\|test.skip" packages/*/src --include="*.test.*"`

**F. The golden rule** — if you delete the test, would a real bug go undetected? If no, don't write it. If yes, write it. Noise tests cost more than zero tests — they give false confidence, slow down CI, and waste reviewer attention.

### 14. Build validation

Before considering work complete, run **`npm run build`** from the repo root and fix all errors and warnings.

### 15. File naming in group folders

- Under `repositories/` and `services/`, do not suffix filenames with `-repository` or `-service`.
- Prefer concise names: `agent.ts`, `whatsapp.ts`, `plan-limits.ts`.

### 16. AI / codegen

- Use the repository pattern; never bypass logging rules.
- Prefer minimal diffs; no new architecture without approval.

---

# Design system source of truth

**`DESIGN.md` at the repo root** defines the product design system: brand direction, color roles, typography (Lexend), spacing scale, elevation/shadows, radii, and component rules (buttons, inputs, cards, chips, lists, progress).

When adding or changing **customer-facing UI** (pages, layouts, dashboard, marketing surfaces, and shared primitives under `frontend/src/components/ui`):

1. **Read `DESIGN.md` first** for the relevant section (colors, type, layout, elevation, shapes, components).
2. **Prefer design tokens** in `frontend/src/globals.css`: semantic colors (`primary`, `secondary`, `muted`, `card`, `border`, `ring`), radii from `--radius*`, `shadow-soft` / `shadow-elevated`, and shared components (`Card`, `Button`, `Input`, etc.).
3. **Do not introduce ad hoc palettes** (random hex / unrelated greens / off-brand fonts) for primary surfaces, CTAs, or typography when a token or `DESIGN.md` value applies.
4. **Cards** (per `DESIGN.md`): solid white, **Level 1** shadow + **1px outline-variant border**, **1rem** radius; no semi-transparent or blurred card shells; do **not** change page/panel background colors to fix card visibility; nested rows may use Secondary fill; primary controls use **0.5rem** radius unless the doc specifies otherwise.
5. **Delete / destructive actions:** Use `Button` `variant="destructive"` (solid red, white text) for triggers and confirm buttons — not `outline` or pale destructive tints.
6. If a requirement is ambiguous, **match `DESIGN.md` prose and its YAML frontmatter**; if something is missing, extend tokens in `globals.css` in line with the doc rather than diverging.

Internal-only assets (logs, emails not shown in-app, etc.) are out of scope unless they are user-visible.

---

# Product features document (`README.md`)

- The repo root **`README.md`** describes **what the product features are** and **how they work** from a product/developer orientation.
- When a change **materially alters** a documented feature—or adds/removes/renames one—**update `README.md` in the same change** (or immediately after if split across PRs) so it matches shipped behavior.
- **Update when** user-visible behavior, workflows, limits, integrations, or feature boundaries change; naming or positioning of a capability in-product should stay consistent with the doc where it applies.
- **Skip** updates for purely internal refactors, renames only in code, or fixes that restore previously documented behavior.

If unsure whether copy belongs in `README.md` vs implementation-only comments: prefer **`README.md`** for durable “what this feature is / does” descriptions.

---

# Paginated listings (default)

For dashboard **lists** of records (contacts, templates, sidebar indexes, searchable tables, etc.):

- **Default to pagination** (or virtualized equivalents) whenever the dataset can grow without a strict small cap—the UI should stay usable and avoid dumping huge DOM trees.
- Use an explicit **`pageSize` constant** (product default is often ~7–25 depending on density; Templates use `RESPONSE_TEMPLATE_UI_PAGE_SIZE` for group and entry lists).
- Reuse shared controls when they exist (`TablePagination`).
- Prefer **cursor / offset pagination** wired through the repository when data is fetched per page from the backend; client-only slice is acceptable when the parent already loads a bounded aggregate.

**Exceptions (do not blindly paginate):**

- **Multi-field forms** where each row is part of one submit payload (for example unchecked checkboxes omitted from FormData)—use controlled inputs, sticky “select all”, or APIs that tolerate partial payloads; naive page toggles lose state.
- **Small fixed caps** that are enforced in the domain (few inline options).

When adding a **new listing**, paginate upfront unless there is an explicit reason it stays tiny.

---

# Transient success feedback

Positive confirmation that a **specific save or action succeeded** must not linger indefinitely:

- Prefer **automatic dismissal** after a few seconds for page-level banners, inline “saved” hints, or similar—not only for Agent setup—and clear URL query flags like `success=` when used for flash messaging.
- Rationale: a visible “saved” message can wrongly imply unrelated later edits or actions succeeded.

Share a single delay constant where practical (`TRANSIENT_SUCCESS_FEEDBACK_MS` in `frontend/src/lib/transient-feedback.ts`).

---

# Instructions vs. explanatory copy

- In customer-facing UI (forms, setup wizards, dashboards, settings), keep the **default view text-light**: short **imperatives** and field labels only (what to do next).
- Put **definitions, rationale, edge cases, workflow context, and multi-sentence guidance** behind a clear **info affordance** — the standard control is **`InlineHelpHint`** (`@/components/ui/inline-help-hint`: circled **i** button, click to open, Escape or click-outside to dismiss, content portaled so it is not clipped by `Card` overflow).
- Do not replace required **inline validation/error messages** or **legally necessary** copy with tooltips; those stay visible when applicable.
- Tooltip bodies may use short paragraphs; avoid repeating the same paragraph in both the page and the hint.

When adding new dense copy, default to: **one line of instruction on-page + i for the rest.**

---

# Form primary actions (Save / Submit)

For buttons whose purpose is to persist edits from inputs on the same form:

- Keep the primary action **disabled** until there is something meaningful to submit (typically **dirty state**: current field values differ from the loaded / baseline values after trim/normalization).
- Also disable while a **submit is in flight** (`loading` / `busy`).
- Do **not** rely on HTTP submit alone to block redundant saves; gate in the UI so users do not trigger pointless requests.

**Exceptions (still gate, but baseline differs):**

- **Create flows** where there is no prior entity: disable until minimum validation passes (required fields, format).
- **Password / credential updates** where the baseline is “empty”: disable until inputs satisfy policy (length, match) so there is still nothing to submit until the user has entered a valid payload.

Apply this pattern to settings forms, dialogs that edit a record, and similar edit-save flows unless the UX intentionally uses autosave without a primary button.

## Long or multi-section forms (inline save affordance)

When a single primary **Save** at the bottom of a long page is easy to miss, prefer **inline Save** actions (`type="submit"` with the same handler when the form is one `<form>`) **next to the control or label row that changed**, or at minimum next to the section title, so users save where they edit.

- Show a save only when **the relevant slice** has drifted from its baseline, so the affordance matches what will change.
- **Disable** that save while **that slice is clean** (or match product rules) and **while saving** so redundant submits are avoided.

## Agent setup (explicit)

On **Agent setup → Profile**, there is **no** bottom **Save agent** control. Primary **Save** buttons (default `Button` / same styling as **Create New Agent**) appear **only next to the control(s) that drifted** from baseline (profile name vs behavior separately; connection beside the dropdown; **Knowledge** and **Capability** subsections each get a save on the **Workspace context**, **Response templates**, **Topics that need a human**, **Tools**, and **Skills** heading rows when that slice differs; labels beside the checkbox). Each stays **disabled** until **its** drift flag is true, and **disabled while saving**. Remount or reset baseline after a successful save so dirty flags clear until further edits. All inline saves submit the same agent update payload (full form `FormData`).

Banner and inline copy for **Agent saved.** / equivalent must **auto-dismiss** after a bounded delay—see [Transient success feedback](#transient-success-feedback).

import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const AGENT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const EVAL_ID = "11111111-2222-3333-4444-555555555555";

type EvalCase = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  source: "manual" | "conversation" | "template" | "context" | "handoff";
  status: "draft" | "ready";
  turns: Array<{ role: "user" | "assistant"; content: string }>;
  expectedReply: string;
  expectedAction: "reply" | "handoff";
  expectedTopicEntryId: string | null;
  expectedTopicLabel: string | null;
  answerAnalysis: string | null;
  answerCorrect: boolean | null;
  sourceConversationId: string | null;
  runs: Array<{
    id: string;
    status: "passed" | "failed" | "error";
    actualReply: string;
    ranAt: string;
    errorMessage?: string | null;
  }>;
  createdAt: string;
};

function createEval(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: EVAL_ID,
    title: "Business hours question",
    agentId: AGENT_ID,
    agentName: "Support agent",
    source: "manual",
    status: "ready",
    turns: [{ role: "user", content: "What are your business hours?" }],
    expectedReply: "We're open Monday to Friday, 9am–6pm SGT.",
    expectedAction: "reply",
    expectedTopicEntryId: null,
    expectedTopicLabel: null,
    answerAnalysis: null,
    answerCorrect: null,
    sourceConversationId: null,
    runs: [],
    createdAt: "2026-08-08T04:00:00.000Z",
    ...overrides,
  };
}

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "senqo_auth",
      JSON.stringify({ accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" }),
    );
    localStorage.setItem("senqo_active_workspace", JSON.stringify("ws-1"));
  });
}

async function mockEvalsApis(page: Page, state: { current: EvalCase | null; cases: EvalCase[] }) {
  const authUser = { id: "e2e-user-1", email: "e2e@senqo.app" };

  await page.route("**/api/auth/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/session") && route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: authUser }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/api/user/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path.endsWith("/api/user/workspaces") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaces: [{ id: WORKSPACE_ID, name: "E2E Workspace", role: "owner" }],
        }),
      });
      return;
    }

    if (path.endsWith("/api/user/agents") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          agents: [
            {
              id: AGENT_ID,
              profile_name: "Support agent",
              behavior: "",
              tools: [],
              skills: [],
              updated_at: "2026-01-01T00:00:00.000Z",
              first_used_at: null,
              auto_assign_conversation_labels: true,
              response_template_groups: [],
              handoff_topic_groups: [],
              context_groups: [],
              asset_groups: [],
              handoff_notify_user_ids: [],
            },
          ],
          agentIdsWithConnection: [],
          responseTemplateGroups: [],
          handoffTopicGroups: [],
          workspaceContextGroups: [],
          workspaceAssetGroups: [],
        }),
      });
      return;
    }

    if (path.endsWith("/api/user/custom-tools") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tools: [] }),
      });
      return;
    }

    if (path.endsWith("/api/user/skills") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      });
      return;
    }

    if (path.endsWith("/api/user/connections") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [] }),
      });
      return;
    }

    if (path.endsWith("/api/user/evals") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cases: state.cases,
          total: state.cases.length,
          page: 1,
          pageSize: 8,
        }),
      });
      return;
    }

    if (path.endsWith("/api/user/evals") && method === "POST") {
      const body = route.request().postDataJSON() as {
        title: string;
        agentId: string;
        userMessage: string;
        expectedReply: string;
      };
      const created = createEval({
        id: "99999999-aaaa-bbbb-cccc-ddddeeeeffff",
        title: body.title,
        agentId: body.agentId,
        turns: [{ role: "user", content: body.userMessage }],
        expectedReply: body.expectedReply,
      });
      state.cases = [created, ...state.cases];
      state.current = created;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ evalCase: created }),
      });
      return;
    }

    if (path.includes("/api/user/evals/") && path.endsWith("/run") && method === "POST") {
      const id = path.split("/").slice(-2)[0];
      const idx = state.cases.findIndex((c) => c.id === id);
      const current = idx >= 0 ? state.cases[idx] : state.current;
      if (!current) {
        await route.fulfill({ status: 404, body: JSON.stringify({ error: "not_found" }) });
        return;
      }
      const next: EvalCase = {
        ...current,
        answerCorrect: true,
        answerAnalysis: "Latest run matched the expected reply.",
        runs: [
          {
            id: "run-e2e-1",
            status: "passed",
            actualReply: current.expectedReply,
            ranAt: "2026-08-13T02:00:00.000Z",
          },
          ...current.runs,
        ],
      };
      if (idx >= 0) state.cases[idx] = next;
      state.current = next;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evalCase: next }),
      });
      return;
    }

    if (path.includes("/api/user/evals/") && method === "GET") {
      const id = path.split("/").pop();
      const found = state.cases.find((c) => c.id === id) ?? state.current;
      if (!found) {
        await route.fulfill({ status: 404, body: JSON.stringify({ error: "not_found" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ evalCase: found }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

test.describe("Evals", () => {
  // Happy path: open Evals for an agent and see the seeded case title in the list.
  test("opens Evals and shows cases for the selected agent", async ({ page }) => {
    const seeded = createEval();
    const state = { current: seeded, cases: [seeded] };
    await seedSession(page);
    await mockEvalsApis(page, state);

    await page.goto(`/${WORKSPACE_ID}/evals`);
    await expect(page.getByRole("heading", { name: "Evals" })).toBeVisible();
    await expect(page.getByText("Business hours question")).toBeVisible();
  });

  // Manual create dialog → new case appears and is selected in the detail pane.
  test("creates a manual eval from the dialog", async ({ page }) => {
    const state = { current: null as EvalCase | null, cases: [] as EvalCase[] };
    await seedSession(page);
    await mockEvalsApis(page, state);

    await page.goto(`/${WORKSPACE_ID}/evals`);
    await page.getByRole("button", { name: /Create eval/i }).click();
    await page.getByLabel("Title").fill("Pricing check");
    await page.getByLabel("Customer message").fill("How much is Pro?");
    await page.getByLabel("Expected reply").fill("Pro is $29/mo.");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByText("Pricing check")).toBeVisible();
    await expect(page.getByText("How much is Pro?")).toBeVisible();
  });

  // Run eval → run history shows the new pass entry (critical feedback loop).
  test("running an eval shows pass in run history", async ({ page }) => {
    const seeded = createEval();
    const state = { current: seeded, cases: [seeded] };
    await seedSession(page);
    await mockEvalsApis(page, state);

    await page.goto(`/${WORKSPACE_ID}/evals?evalId=${EVAL_ID}`);
    await page.getByRole("button", { name: "Run eval" }).click();
    await page.getByRole("tab", { name: "Run history" }).click();
    await expect(page.getByText(/Pass|Passed/i).first()).toBeVisible();
    await expect(page.getByText("We're open Monday to Friday, 9am–6pm SGT.")).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const AGENT_ID = "agent-e2e-1";
const CONTEXT_GROUP_ID = "ctx-group-1";

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "senqo_auth",
      JSON.stringify({ accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" }),
    );
    localStorage.setItem("senqo_active_workspace", JSON.stringify("ws-1"));
  });
}

async function mockKnowledgeApis(page: Page) {
  const authUser = { id: "e2e-user-1", email: "e2e@senqo.app" };
  const staleUpdatedAt = new Date();
  staleUpdatedAt.setUTCDate(staleUpdatedAt.getUTCDate() - 120);

  await page.route("**/api/auth/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/session") && method === "GET") {
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
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/api/user/agents") && method === "GET" && !url.includes("knowledge-import")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          agents: [
            {
              id: AGENT_ID,
              profile_name: "Support Bot",
              behavior: "Helpful",
              tools: [],
              skills: [],
              updated_at: "2026-01-01T00:00:00.000Z",
              first_used_at: null,
              auto_assign_conversation_labels: true,
              response_template_groups: [],
              handoff_topic_groups: [],
              context_groups: [CONTEXT_GROUP_ID],
              asset_groups: [],
              handoff_notify_user_ids: [],
            },
          ],
          agentIdsWithConnection: [],
          responseTemplateGroups: [],
          handoffTopicGroups: [],
          workspaceContextGroups: [
            {
              id: CONTEXT_GROUP_ID,
              name: "Company facts",
              updated_at: staleUpdatedAt.toISOString(),
              entry_count: 2,
            },
          ],
          workspaceAssetGroups: [],
        }),
      });
      return;
    }

    if (url.includes(`/workspace-context-groups/${CONTEXT_GROUP_ID}`) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          group: {
            id: CONTEXT_GROUP_ID,
            name: "Company facts",
            updated_at: staleUpdatedAt.toISOString(),
            entries: [],
          },
        }),
      });
      return;
    }

    if (url.includes("/knowledge-import/jobs") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jobs: [] }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test.describe("Knowledge page", () => {
  // Happy path: Knowledge nav opens context authoring with Import docs and entry counts.
  test("shows Knowledge page with entry counts and Import docs", async ({ page }) => {
    await seedSession(page);
    await mockKnowledgeApis(page);
    await page.goto(`/${WORKSPACE_ID}/knowledge`);

    await expect(page.getByRole("heading", { name: "Knowledge" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import docs" })).toBeEnabled();
    await expect(page.getByRole("link", { name: /Company facts/ })).toBeVisible();
    await expect(page.getByText("2/50 entries")).toBeVisible();
  });

  // Critical: Import docs requires choosing an agent before drafting knowledge.
  test("Import docs opens with agent picker", async ({ page }) => {
    await seedSession(page);
    await mockKnowledgeApis(page);
    await page.goto(`/${WORKSPACE_ID}/knowledge`);
    await page.getByRole("button", { name: "Import docs" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Import docs" })).toBeVisible();
    await expect(dialog.getByText("Attach to agent")).toBeVisible();
    await expect(dialog.locator("select")).toHaveValue(AGENT_ID);
  });

  // Critical: Profile attach label is Attached knowledge (not colliding with nav Knowledge).
  test("Agent Profile shows Attached knowledge section", async ({ page }) => {
    await seedSession(page);
    await mockKnowledgeApis(page);
    await page.route("**/api/user/custom-tools", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tools: [] }),
      });
    });
    await page.route("**/api/user/skills", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      });
    });
    await page.route("**/api/user/connections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [] }),
      });
    });
    await page.goto(`/${WORKSPACE_ID}/agent?agentId=${AGENT_ID}`);
    await expect(page.getByRole("tab", { name: "Attached knowledge" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Capability" })).toBeVisible();
  });
});

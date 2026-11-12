import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const AGENT_ID = "agent-e2e-1";
const BUTTON_GROUP_ID = "bt-group-1";
const BUTTON_ENTRY_ID = "bt-entry-1";

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "senqo_auth",
      JSON.stringify({ accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" }),
    );
    localStorage.setItem("senqo_active_workspace", JSON.stringify("ws-1"));
  });
}

async function mockButtonTemplateApis(page: Page) {
  const authUser = { id: "e2e-user-1", email: "e2e@senqo.app" };

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
    if (url.endsWith("/refresh") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "e2e-access-token",
          refreshToken: "e2e-refresh-token",
          user: authUser,
        }),
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
              button_template_groups: [BUTTON_GROUP_ID],
              handoff_topic_groups: [],
              context_groups: [],
              asset_groups: [],
              handoff_notify_user_ids: [],
            },
          ],
          agentIdsWithConnection: [],
          responseTemplateGroups: [],
          buttonTemplateGroups: [
            {
              id: BUTTON_GROUP_ID,
              name: "Sales",
              updated_at: "2026-01-01T00:00:00.000Z",
              entry_count: 1,
            },
          ],
          handoffTopicGroups: [],
          workspaceContextGroups: [],
          workspaceAssetGroups: [],
        }),
      });
      return;
    }

    if (url.includes(`/api/user/button-template-groups/${BUTTON_GROUP_ID}`) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          group: {
            id: BUTTON_GROUP_ID,
            name: "Sales",
            updated_at: "2026-01-01T00:00:00.000Z",
            entries: [
              {
                id: BUTTON_ENTRY_ID,
                sort_order: 0,
                title: "Confirm appointment",
                body: "Should I confirm your 3pm appointment?",
                buttons: [{ type: "quick_reply", label: "Yes", value: "yes" }],
              },
            ],
          },
        }),
      });
      return;
    }

    if (url.includes("/button-template-groups") && url.endsWith("/entries") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entry: {
            id: "bt-entry-new",
            sort_order: 1,
            title: "Book a demo",
            body: "Want me to book a demo?",
            buttons: [{ type: "quick_reply", label: "Book", value: "book" }],
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

test.describe("Knowledge → Button templates", () => {
  // Happy path: the Button templates tab lists the workspace group and its saved
  // template, and expanding the row shows the message customers would receive.
  test("lists button groups and opens a template", async ({ page }) => {
    await seedSession(page);
    await mockButtonTemplateApis(page);
    await page.goto(`/${WORKSPACE_ID}/knowledge?tab=buttons`);

    await expect(page.getByRole("tab", { name: "Button templates" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("link", { name: /Sales/ })).toBeVisible();
    await expect(page.getByText("1/50 templates")).toBeVisible();

    await page.getByRole("button", { name: /Confirm appointment/ }).click();
    await expect(
      page.locator("p", { hasText: "Should I confirm your 3pm appointment?" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Save template" })).toBeInViewport();
  });

  // Critical: the add dialog previews the exact message and buttons before save,
  // and its Cancel / Add template actions stay pinned in view even on a short
  // viewport where the form body has to scroll.
  test("add template dialog previews the button message with pinned actions", async ({ page }) => {
    await seedSession(page);
    await mockButtonTemplateApis(page);
    await page.setViewportSize({ width: 900, height: 520 });
    await page.goto(`/${WORKSPACE_ID}/knowledge?tab=buttons`);

    await page.getByRole("button", { name: "Add template" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /New button template/ })).toBeVisible();

    await dialog.getByLabel("Name").fill("Book a demo");
    await dialog.getByLabel("Message text").fill("Want me to book a demo?");
    await dialog.getByLabel("Label").fill("Book");
    await dialog.getByLabel("Reply id").fill("book");

    await expect(
      dialog.locator("p", { hasText: "Want me to book a demo?" }),
    ).toBeVisible();
    await expect(dialog.locator("span", { hasText: "Book" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Add template" })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Add template" })).toBeEnabled();
  });

  // Critical: the agent profile exposes the Button templates attach so the
  // admin controls which templates this agent may send.
  test("agent profile attaches button templates", async ({ page }) => {
    await seedSession(page);
    await mockButtonTemplateApis(page);
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

    await expect(page.getByText("Button templates")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Sales/ })).toBeChecked();
  });
});

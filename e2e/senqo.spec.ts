import { test, expect } from "@playwright/test";

/**
 * E2E tests for Senqo.
 *
 * Run against the full `docker compose up -d` stack:
 *   npx playwright test
 *
 * These tests intercept API calls and mock responses to avoid needing a real
 * backend + database. Comment out page.route() blocks and run against a real
 * environment when E2E validation of the full stack is needed.
 */

const SEED_USER = {
  id: "e2e-user-1",
  email: "e2e@senqo.app",
  accessToken: "e2e-access-token",
  refreshToken: "e2e-refresh-token",
};

function mockAuthApi(page: import("@playwright/test").Page) {
  return page.route("**/api/auth/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/register") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: SEED_USER.accessToken,
          refreshToken: SEED_USER.refreshToken,
          user: { id: SEED_USER.id, email: SEED_USER.email },
        }),
      });
      return;
    }
    if (url.endsWith("/login") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: SEED_USER.accessToken,
          refreshToken: SEED_USER.refreshToken,
          user: { id: SEED_USER.id, email: SEED_USER.email },
        }),
      });
      return;
    }
    if (url.endsWith("/refresh") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: SEED_USER.accessToken,
          refreshToken: SEED_USER.refreshToken,
          user: { id: SEED_USER.id, email: SEED_USER.email },
        }),
      });
      return;
    }
    if (url.endsWith("/logout") && method === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (url.endsWith("/config") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ allowPublicRegistration: true }),
      });
      return;
    }
    if (url.endsWith("/session") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: SEED_USER.id, email: SEED_USER.email },
          isInstanceAdmin: false,
        }),
      });
      return;
    }
    await route.continue();
  });
}

function mockUserApi(page: import("@playwright/test").Page) {
  return page.route("**/api/user/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/workspaces")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaces: [{ id: "ws-1", name: "E2E Workspace", role: "owner" }],
        }),
      });
      return;
    }
    if (url.includes("/conversations") && !url.includes("/messages") && !url.includes("/agent-messages") && !url.includes("/labels")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ conversations: [] }),
      });
      return;
    }
    if (url.includes("/conversation-labels")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ labels: [{ id: "lbl-1", name: "Support", description: "Support requests" }] }),
      });
      return;
    }
    if (url.includes("/contacts") && !url.includes("/options")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          contacts: [
            { id: "c1", first_name: "Alice", last_name: "Smith", phone: "+1234567890", is_test: false, has_conversation: true, has_task: false, metadata: null, created_at: new Date().toISOString() },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
      return;
    }
    if (url.includes("/contacts/options")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ contacts: [{ id: "c1", label: "Alice Smith (+1234567890)" }] }),
      });
      return;
    }
    if (url.includes("/connections") && !url.includes("/mode") && !url.includes("/refresh-qr") && !url.includes("/reconnect")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [], events: [], canCreateConnection: true, connectionUnavailableReason: null }),
      });
      return;
    }
    if (url.includes("/agents")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          agents: [],
          agentIdsWithConnection: [],
          responseTemplateGroups: [],
          handoffTopicGroups: [],
          workspaceContextGroups: [],
          workspaceAssetGroups: [],
        }),
      });
      return;
    }
    if (url.includes("/tasks") && route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }),
      });
      return;
    }
    if (url.includes("/skills")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      });
      return;
    }
    if (url.includes("/api-keys")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ apiKeys: [] }),
      });
      return;
    }
    if (url.includes("/profile") || url.includes("/change-password")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    if (url.includes("/team")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ members: [] }),
      });
      return;
    }
    await route.continue();
  });
}

// ── 6.1 Auth Flow ───────────────────────────────────────────────────────────

test.describe("6.1 Auth Flow", () => {
  // Happy path: user fills in the sign-up form, submits, and is redirected away from the sign-up page (to the dashboard).
  test("visit /sign-up → fill form → submit → redirected to dashboard", async ({ page }) => {
    await mockAuthApi(page);
    await mockUserApi(page);

    await page.goto("/sign-up");

    await expect(page.getByRole("heading", { name: /Create your account/i })).toBeVisible();
    await page.getByLabel("Name").fill("E2E User");
    await page.getByLabel("Email").fill("e2e@senqo.app");
    await page.getByLabel("Password").fill("password123");

    await page.getByRole("button", { name: /Create account/i }).click();

    // Should navigate away from sign-up page
    await page.waitForURL((u) => !u.pathname.startsWith("/sign-up"), { timeout: 10_000 });
  });

  // Happy path: existing user fills in the sign-in form, submits, and is redirected away from the sign-in page.
  test("visit /sign-in → fill form → submit → redirected away from sign-in", async ({ page }) => {
    await mockAuthApi(page);
    await mockUserApi(page);

    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await page.getByLabel("Email").fill("e2e@senqo.app");
    await page.getByLabel("Password").fill("password123");

    await page.getByRole("button", { name: /Sign in/i }).click();

    await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 10_000 });
  });

  // Unauthenticated users visiting a protected route must be redirected to the sign-in page.
  test("visit protected route without auth → redirected to /sign-in", async ({ page }) => {
    await mockAuthApi(page);
    await mockUserApi(page);

    await page.goto("/");

    // The app should redirect unauthenticated users to sign-in
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 });
  });
});


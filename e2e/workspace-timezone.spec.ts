import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const USER_ID = "e2e-user-1";

type WorkspaceState = {
  timezone: string;
  role: "owner" | "member";
};

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "senqo_auth",
      JSON.stringify({ accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" }),
    );
    localStorage.setItem("senqo_active_workspace", JSON.stringify("ws-1"));
  });
}

async function mockApis(page: Page, state: WorkspaceState) {
  const authUser = { id: USER_ID, email: "e2e@senqo.app" };

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

    if (url.includes("/workspaces")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaces: [{ id: WORKSPACE_ID, name: "E2E Workspace", role: state.role }],
        }),
      });
      return;
    }

    if (url.includes("/profile") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: { id: USER_ID, email: authUser.email, firstName: "E2E", lastName: "User" },
          workspace: {
            id: WORKSPACE_ID,
            name: "E2E Workspace",
            timezone: state.timezone,
            createdAt: "2026-01-01T00:00:00.000Z",
            role: state.role,
          },
          storage: { usedBytes: 128, breakdown: { assetsBytes: 64, mediaBytes: 64 } },
        }),
      });
      return;
    }

    if (url.includes("/workspace") && method === "PUT") {
      const body = route.request().postDataJSON() as { timezone?: string };
      if (body.timezone) state.timezone = body.timezone;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test.describe("Workspace timezone setting", () => {
  // Happy path: owner changes the workspace timezone and the saved value is persisted.
  test("saves a new timezone and shows confirmation", async ({ page }) => {
    const state: WorkspaceState = { timezone: "UTC", role: "owner" };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/workspace`);

    const timezone = page.getByLabel("Timezone", { exact: true });
    await expect(timezone).toHaveValue("UTC");

    await timezone.selectOption("Asia/Kuala_Lumpur");
    const requestPromise = page.waitForRequest(
      (request) => request.url().includes("/api/user/workspace") && request.method() === "PUT",
    );
    await page.getByRole("button", { name: "Save workspace" }).click();

    const request = await requestPromise;
    expect(request.postDataJSON()).toEqual({ timezone: "Asia/Kuala_Lumpur" });
    await expect(page.getByText("workspace updated")).toBeVisible();
    await expect(timezone).toHaveValue("Asia/Kuala_Lumpur");
  });

  // Save stays disabled until the timezone actually differs from the stored value.
  test("keeps save disabled until the timezone changes", async ({ page }) => {
    const state: WorkspaceState = { timezone: "UTC", role: "owner" };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/workspace`);

    const save = page.getByRole("button", { name: "Save workspace" });
    await expect(save).toBeDisabled();

    await page.getByLabel("Timezone", { exact: true }).selectOption("Europe/London");
    await expect(save).toBeEnabled();
  });

  // Members cannot change workspace settings; only the owner sees the save action.
  test("disables the timezone control for members", async ({ page }) => {
    const state: WorkspaceState = { timezone: "UTC", role: "member" };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/workspace`);

    await expect(page.getByLabel("Timezone", { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save workspace" })).toHaveCount(0);
  });
});

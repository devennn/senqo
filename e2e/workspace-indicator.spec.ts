import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const USER_ID = "e2e-user-1";

type WorkspaceState = {
  name: string;
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
          workspaces: [{ id: WORKSPACE_ID, name: state.name, role: "owner" }],
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
            name: state.name,
            timezone: "UTC",
            createdAt: "2026-01-01T00:00:00.000Z",
            role: "owner",
          },
          storage: { usedBytes: 128, breakdown: { assetsBytes: 64, mediaBytes: 64 } },
        }),
      });
      return;
    }

    if (url.endsWith("/workspace") && method === "PUT") {
      const body = route.request().postDataJSON() as { name?: string };
      if (body.name) state.name = body.name;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (url.includes("/connections") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connections: [] }),
      });
      return;
    }

    if (url.match(/\/team\/?(\?.*)?$/) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          members: [
            {
              id: USER_ID,
              userId: USER_ID,
              email: authUser.email,
              role: "owner",
              joined_at: "2026-01-01T00:00:00.000Z",
              handoffPhones: [],
              receivesErrorAlerts: false,
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test.describe("Current workspace indicator", () => {
  // Happy path: any workspace page names the active workspace in the desktop sidebar.
  test("shows the workspace name in the desktop sidebar", async ({ page }) => {
    await seedSession(page);
    await mockApis(page, { name: "Acme Co" });
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    await expect(
      page.getByRole("complementary").getByText("Acme Co"),
    ).toBeVisible();
  });

  // Renaming the workspace in Settings must update the shell without a reload.
  test("updates the sidebar name after a workspace rename", async ({ page }) => {
    await seedSession(page);
    await mockApis(page, { name: "Old name" });
    await page.goto(`/${WORKSPACE_ID}/settings/workspace`);

    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByText("Old name")).toBeVisible();

    const nameInput = page.getByLabel("Workspace name");
    await nameInput.fill("New name");
    await page.getByRole("button", { name: "Save workspace" }).click();

    await expect(sidebar.getByText("New name")).toBeVisible();
  });

  // Mobile users find the active workspace row inside the navigation sheet.
  test("shows the workspace name in the mobile navigation sheet", async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 900 });
    await seedSession(page);
    await mockApis(page, { name: "Acme Co" });
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("link", { name: "Acme Co" })).toBeVisible();
  });
});

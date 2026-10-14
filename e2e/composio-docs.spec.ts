import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "senqo_auth",
      JSON.stringify({ accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" }),
    );
    localStorage.setItem("senqo_active_workspace", JSON.stringify("ws-1"));
  });
}

async function mockAuth(page: Page) {
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
}

test.describe("Composio Google Drive + live Docs", () => {
  // Happy path: Connect → Apps shows Google Drive card and Connect control when mocked disconnected.
  test("Connect Apps tab shows Google Drive connect card", async ({ page }) => {
    await seedSession(page);
    await mockAuth(page);

    await page.route("**/api/user/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/api/user/apps") && !url.includes("linked-docs") && !url.includes("googledrive")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            composioConfigured: true,
            apps: [
              {
                toolkit: "googledrive",
                displayName: "Google Drive",
                status: "not_connected",
                connectedAt: null,
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/connections")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ connections: [], events: [] }),
        });
        return;
      }
      if (url.includes("/workspaces")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspaces: [{ id: WORKSPACE_ID, name: "E2E Workspace", role: "owner" }],
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto(`/${WORKSPACE_ID}/connect?tab=apps`);
    await expect(page.getByRole("heading", { name: "Connect" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Apps" })).toBeVisible();
    await expect(page.getByText("Google Drive")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect Google Drive" }),
    ).toBeEnabled();
  });

  // Critical: Add docs Save stays disabled until description is non-empty (and a file is chosen).
  test("Add docs requires description before Save", async ({ page }) => {
    await seedSession(page);
    await mockAuth(page);

    await page.route("**/api/user/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/linked-docs")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ docs: [] }),
        });
        return;
      }
      if (url.includes("/api/user/apps")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            composioConfigured: true,
            apps: [
              {
                toolkit: "googledrive",
                displayName: "Google Drive",
                status: "active",
                connectedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/agents") && !url.includes("knowledge-import")) {
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
      if (url.includes("/knowledge-import/jobs")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ jobs: [] }),
        });
        return;
      }
      if (url.includes("/workspaces")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspaces: [{ id: WORKSPACE_ID, name: "E2E Workspace", role: "owner" }],
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto(`/${WORKSPACE_ID}/knowledge?tab=docs`);
    await expect(page.getByRole("tab", { name: "Docs" })).toBeVisible();
    await page.getByRole("button", { name: "Add docs" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add docs" })).toBeVisible();
    const save = dialog.getByRole("button", { name: "Save" });
    await expect(save).toBeDisabled();

    await dialog.getByLabel("What is this file about?").fill("Kitchen inventory sheet");
    // Still disabled — no file selected yet.
    await expect(save).toBeDisabled();
  });

  // Critical: linked-docs list API shape shown on Docs tab after create mock.
  test("Docs tab lists linked doc with source badge and description", async ({ page }) => {
    await seedSession(page);
    await mockAuth(page);

    await page.route("**/api/user/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/linked-docs")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            docs: [
              {
                id: "doc-1",
                workspace_id: WORKSPACE_ID,
                source: "google_drive",
                file_name: "stock.csv",
                mime_type: "text/csv",
                description: "Live kitchen inventory",
                drive_file_id: "drive-1",
                storage_path: null,
                file_size_bytes: 0,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/api/user/apps")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            composioConfigured: true,
            apps: [
              {
                toolkit: "googledrive",
                displayName: "Google Drive",
                status: "active",
                connectedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          }),
        });
        return;
      }
      if (url.includes("/agents") && !url.includes("knowledge-import")) {
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
      if (url.includes("/knowledge-import/jobs")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ jobs: [] }),
        });
        return;
      }
      if (url.includes("/workspaces")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspaces: [{ id: WORKSPACE_ID, name: "E2E Workspace", role: "owner" }],
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto(`/${WORKSPACE_ID}/knowledge?tab=docs`);
    await expect(page.getByText("stock.csv")).toBeVisible();
    await expect(page.getByText("Google Drive")).toBeVisible();
    await expect(page.getByText("Live kitchen inventory")).toBeVisible();
  });
});

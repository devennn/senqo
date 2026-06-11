import { test, expect, type Page } from "@playwright/test";

const AUTH_USER = { id: "e2e-user-1", email: "invited@company.com" };
const ACCESS_TOKEN = "e2e-access-token";
const REFRESH_TOKEN = "e2e-refresh-token";
const INVITE_TOKEN = "e2e-invite-token";

type WorkspaceListItem = {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  role: "owner" | "member" | "superadmin";
};

async function seedAuthTokens(page: Page) {
  await page.addInitScript(
    ([accessToken, refreshToken]) => {
      localStorage.setItem(
        "senqo_auth",
        JSON.stringify({ accessToken, refreshToken }),
      );
    },
    [ACCESS_TOKEN, REFRESH_TOKEN],
  );
}

type AuthMockOptions = {
  allowPublicRegistration?: boolean;
  isInstanceAdmin?: boolean;
  inviteEmail?: string | null;
};

async function mockAuthApi(page: Page, options: AuthMockOptions = {}) {
  const {
    allowPublicRegistration = true,
    isInstanceAdmin = false,
    inviteEmail = null,
  } = options;

  await page.route("**/api/auth/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/config") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ allowPublicRegistration }),
      });
      return;
    }

    if (url.includes("/invite?") && method === "GET") {
      if (inviteEmail) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ email: inviteEmail }),
        });
      } else {
        await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      }
      return;
    }

    if (url.endsWith("/register") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: ACCESS_TOKEN,
          refreshToken: REFRESH_TOKEN,
          user: { ...AUTH_USER, isInstanceAdmin: false },
        }),
      });
      return;
    }

    if (url.endsWith("/refresh") && method === "POST") {
      const body = route.request().postDataJSON() as { refreshToken?: string } | null;
      if (!body?.refreshToken) {
        await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: ACCESS_TOKEN,
          refreshToken: REFRESH_TOKEN,
          user: { ...AUTH_USER, isInstanceAdmin },
        }),
      });
      return;
    }

    if (url.endsWith("/session") && method === "GET") {
      const auth = route.request().headers()["authorization"] ?? "";
      if (!auth.includes(ACCESS_TOKEN)) {
        await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { ...AUTH_USER, isInstanceAdmin },
          isInstanceAdmin,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function mockWorkspaceApi(page: Page, state: { workspaces: WorkspaceListItem[] }) {
  await page.route("**/api/user/workspaces**", async (route) => {
    const method = route.request().method();

    if (method === "POST") {
      const body = route.request().postDataJSON() as { name?: string };
      const workspace: WorkspaceListItem = {
        id: "ws-new",
        name: body.name ?? "New workspace",
        ownerUserId: AUTH_USER.id,
        createdAt: new Date().toISOString(),
        role: "owner",
      };
      state.workspaces = [workspace];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ workspaceId: workspace.id }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ workspaces: state.workspaces }),
    });
  });
}

async function mockAdminApi(page: Page) {
  await page.route("**/api/admin/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/settings") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ allowPublicRegistration: false }),
      });
      return;
    }

    if (url.endsWith("/workspaces") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          workspaces: [
            {
              id: "ws-1",
              name: "Admin Workspace",
              owner_user_id: AUTH_USER.id,
              owner_email: AUTH_USER.email,
              created_at: "2026-01-01T00:00:00.000Z",
              member_count: 1,
            },
          ],
        }),
      });
      return;
    }

    if (url.endsWith("/users") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [
            {
              id: AUTH_USER.id,
              email: AUTH_USER.email,
              created_at: "2026-01-01T00:00:00.000Z",
              is_instance_admin: true,
              disabled_at: null,
              owned_workspace_count: 1,
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test.describe("Instance auth", () => {
  // Happy path: user with invite token signs up, sees empty workspace chooser, creates a workspace, lands on its dashboard.
  test("registration invite signup → empty chooser → create workspace", async ({ page }) => {
    const workspaceState = { workspaces: [] as WorkspaceListItem[] };

    await mockAuthApi(page, {
      allowPublicRegistration: false,
      inviteEmail: AUTH_USER.email,
    });
    await mockWorkspaceApi(page, workspaceState);

    await page.goto(`/sign-up?invite=${INVITE_TOKEN}`);

    await expect(page.getByText("Complete signup with your invitation")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(AUTH_USER.email);

    await page.getByLabel("Name").fill("Invited User");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /Create account/i }).click();

    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(
      page.getByText("No workspaces yet. Create one or ask to be added to a project."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Create workspace" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("My Project");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page).toHaveURL(/\/ws-new\/dashboard/, { timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  // When public registration is off and no invite is provided, the sign-up page must show a blocked-state message and disable inputs.
  test("open sign-up blocked when public registration is off and no invite", async ({ page }) => {
    await mockAuthApi(page, { allowPublicRegistration: false });

    await page.goto("/sign-up");

    await expect(page.getByText("Registration is closed. Ask your admin for an invite link.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Create account/i })).toBeDisabled();
    await expect(page.getByLabel("Email")).toBeDisabled();
  });

  // A superadmin user must see the Instance admin link on the workspace chooser, navigate to it, and see admin panel content.
  test("superadmin opens Instance admin from Workspaces page", async ({ page }) => {
    await seedAuthTokens(page);
    await mockAuthApi(page, { isInstanceAdmin: true });
    await mockWorkspaceApi(page, { workspaces: [] });
    await mockAdminApi(page);

    await page.goto("/");

    await expect(page.getByRole("link", { name: /Instance admin/i })).toBeVisible();
    await page.getByRole("link", { name: /Instance admin/i }).click();

    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { name: "Instance admin" })).toBeVisible();
    await expect(page.getByText("Public registration")).toBeVisible();
    await expect(page.getByText("Admin Workspace")).toBeVisible();
  });
});

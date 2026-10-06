import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const OWNER_ID = "e2e-owner";
const ADMIN_ID = "e2e-admin";
const MEMBER_ID = "e2e-member";
const OTHER_ADMIN_ID = "e2e-admin-2";

type Role = "owner" | "admin" | "member";

type TeamMember = {
  id: string;
  userId: string;
  email: string | null;
  role: Role;
  joined_at: string | null;
  handoffPhones: [];
  receivesErrorAlerts: boolean;
};

type RolePatch = {
  userId: string;
  role: "admin" | "member";
};

type TeamState = {
  actorRole: Role;
  members: TeamMember[];
  rolePatches: RolePatch[];
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

async function mockApis(page: Page, state: TeamState) {
  const authUser = { id: state.actorRole === "owner" ? OWNER_ID : state.actorRole === "admin" ? ADMIN_ID : MEMBER_ID, email: "e2e@senqo.app" };

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
          workspaces: [{ id: WORKSPACE_ID, name: "E2E Workspace", role: state.actorRole }],
        }),
      });
      return;
    }

    if (url.includes("/profile") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: { id: authUser.id, email: authUser.email, firstName: "E2E", lastName: "User" },
          workspace: {
            id: WORKSPACE_ID,
            name: "E2E Workspace",
            timezone: "UTC",
            createdAt: "2026-01-01T00:00:00.000Z",
            role: state.actorRole,
          },
          storage: { usedBytes: 0, breakdown: { assetsBytes: 0, mediaBytes: 0 } },
        }),
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

    if (url.includes("/team/role") && method === "PATCH") {
      const body = route.request().postDataJSON() as RolePatch;
      state.rolePatches.push(body);
      state.members = state.members.map((member) =>
        member.userId === body.userId ? { ...member, role: body.role } : member,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (url.match(/\/team\/?(\?.*)?$/) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ members: state.members }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

function member(overrides: Partial<TeamMember> & { userId: string }): TeamMember {
  return {
    id: overrides.userId,
    email: `${overrides.userId}@senqo.app`,
    role: "member",
    joined_at: "2026-01-01T00:00:00.000Z",
    handoffPhones: [],
    receivesErrorAlerts: false,
    ...overrides,
  };
}

test.describe("Team member roles", () => {
  // Happy path: the owner promotes a plain member to Admin and the change persists.
  test("owner promotes a member to admin", async ({ page }) => {
    const state: TeamState = {
      actorRole: "owner",
      members: [
        member({ userId: OWNER_ID, email: "owner@senqo.app", role: "owner" }),
        member({ userId: MEMBER_ID, email: "bob@senqo.app", role: "member" }),
      ],
      rolePatches: [],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    await page.getByRole("button", { name: "Change role for bob@senqo.app" }).click();
    await page.getByRole("menuitem", { name: "Admin" }).click();

    await expect(
      page.getByRole("button", { name: "Change role for bob@senqo.app" }),
    ).toContainText("Admin");
    expect(state.rolePatches).toEqual([{ userId: MEMBER_ID, role: "admin" }]);
  });

  // Admins manage plain members only: owner and other-admin pickers are visible but greyed out.
  test("admin sees role pickers enabled for plain members only", async ({ page }) => {
    const state: TeamState = {
      actorRole: "admin",
      members: [
        member({ userId: OWNER_ID, email: "owner@senqo.app", role: "owner" }),
        member({ userId: ADMIN_ID, email: "admin@senqo.app", role: "admin" }),
        member({ userId: OTHER_ADMIN_ID, email: "carol@senqo.app", role: "admin" }),
        member({ userId: MEMBER_ID, email: "bob@senqo.app", role: "member" }),
      ],
      rolePatches: [],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    await expect(
      page.getByRole("button", { name: "Change role for bob@senqo.app" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Change role for carol@senqo.app" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Change role for owner@senqo.app" }),
    ).toBeDisabled();
  });

  // Members see roles read-only: every picker is greyed out.
  test("member sees disabled role pickers", async ({ page }) => {
    const state: TeamState = {
      actorRole: "member",
      members: [
        member({ userId: OWNER_ID, email: "owner@senqo.app", role: "owner" }),
        member({ userId: MEMBER_ID, email: "bob@senqo.app", role: "member" }),
      ],
      rolePatches: [],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    await expect(page.getByText("Members")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change role for bob@senqo.app" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Change role for owner@senqo.app" }),
    ).toBeDisabled();
  });
});

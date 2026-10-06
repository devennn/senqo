import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const OWNER_USER_ID = "e2e-user-1";
const CONNECTION_ID = "conn-e2e-1";

type HandoffPhoneStatus = "pending" | "verified";

type TeamMemberHandoffPhone = {
  connectionId: string;
  connectionName: string;
  phone: string;
  status: HandoffPhoneStatus;
};

type TeamMember = {
  id: string;
  userId: string;
  email: string | null;
  role: string;
  joined_at: string | null;
  handoffPhones: TeamMemberHandoffPhone[];
  receivesErrorAlerts: boolean;
};

type ErrorAlertPut = {
  userId: string;
  enabled: boolean;
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

async function mockApis(
  page: Page,
  state: { member: TeamMember; errorAlertPuts: ErrorAlertPut[] },
) {
  const authUser = { id: OWNER_USER_ID, email: "e2e@senqo.app" };

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
          workspaces: [{ id: WORKSPACE_ID, name: "E2E Workspace", role: "owner" }],
        }),
      });
      return;
    }

    if (url.includes("/connections") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connections: [
            {
              id: CONNECTION_ID,
              display_name: "Ops Line",
              phone_number: "15550001111",
              status: "authorized",
              last_state_instance: null,
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/team/error-alerts") && method === "PATCH") {
      const body = route.request().postDataJSON() as ErrorAlertPut;
      state.errorAlertPuts.push(body);
      state.member = { ...state.member, receivesErrorAlerts: body.enabled };
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
        body: JSON.stringify({ members: [state.member] }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

function ownerMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: OWNER_USER_ID,
    userId: OWNER_USER_ID,
    email: "e2e@senqo.app",
    role: "owner",
    joined_at: "2026-01-01T00:00:00.000Z",
    handoffPhones: [],
    receivesErrorAlerts: false,
    ...overrides,
  };
}

const verifiedPhone: TeamMemberHandoffPhone = {
  connectionId: CONNECTION_ID,
  connectionName: "Ops Line",
  phone: "60123456789",
  status: "verified",
};

test.describe("Team AI error alerts", () => {
  // Happy path: a member with a verified handoff phone ticks the setting, confirms,
  // and the API persists it — the whole point of letting users opt in without a handoff group.
  test("opts a member in after confirm and persists it", async ({ page }) => {
    const state = {
      member: ownerMember({ handoffPhones: [verifiedPhone] }),
      errorAlertPuts: [] as ErrorAlertPut[],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    const checkbox = page.getByRole("checkbox", { name: /receive ai error alerts/i });
    await expect(checkbox).toBeVisible();
    await checkbox.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Turn on alerts" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(checkbox).toBeChecked();
    expect(state.errorAlertPuts).toEqual([
      { userId: OWNER_USER_ID, enabled: true },
    ]);
  });

  // Cancel on the confirm dialog must leave the member opted out and send no request.
  test("keeps the member opted out when the confirm dialog is cancelled", async ({ page }) => {
    const state = {
      member: ownerMember({ handoffPhones: [verifiedPhone] }),
      errorAlertPuts: [] as ErrorAlertPut[],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    const checkbox = page.getByRole("checkbox", { name: /receive ai error alerts/i });
    await checkbox.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(checkbox).not.toBeChecked();
    expect(state.errorAlertPuts).toHaveLength(0);
  });

  // Without a verified handoff phone there is nowhere to deliver alerts, so the tick stays disabled.
  test("disables the tick when the member has no verified handoff phone", async ({ page }) => {
    const state = {
      member: ownerMember({
        handoffPhones: [
          {
            connectionId: CONNECTION_ID,
            connectionName: "Ops Line",
            phone: "60123456789",
            status: "pending",
          },
        ],
      }),
      errorAlertPuts: [] as ErrorAlertPut[],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/settings/team`);

    await expect(
      page.getByRole("checkbox", { name: /receive ai error alerts/i }),
    ).toBeDisabled();
  });
});

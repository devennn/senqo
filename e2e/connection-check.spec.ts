import { test, expect, type Page, type Route } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const AGENT_ID = "agent-1";
const CONN = "conn-1";

type ConnectionRow = {
  id: string;
  display_name: string;
  phone_number: string | null;
  agent_config_id: string | null;
  mode: string;
  status: string;
  last_state_instance: string | null;
};

type CheckStatus = "connected" | "disconnected" | "pending_qr" | "unavailable";

type ConnectState = {
  connections: ConnectionRow[];
  checkStatus: CheckStatus;
  deleteBlocked: boolean;
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

async function mockConnectApis(page: Page, state: ConnectState) {
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

  await page.route("**/api/user/**", async (route: Route) => {
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

    if (url.endsWith(`/connections/${CONN}/delete-preflight`) && method === "GET") {
      const conn = state.connections[0];
      const attached = Boolean(conn?.agent_config_id);
      const blocked = state.deleteBlocked && attached;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: state.deleteBlocked ? "connected" : state.checkStatus,
          agent: attached ? { id: AGENT_ID, name: "Support" } : null,
          deletable: !blocked,
          blockedReason: blocked ? "connection_attached_to_agent" : null,
        }),
      });
      return;
    }

    if (url.endsWith(`/connections/${CONN}/check`) && method === "POST") {
      if (state.checkStatus === "disconnected") {
        state.connections[0].status = "not_authorized";
        state.connections[0].last_state_instance = "notAuthorized";
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: state.checkStatus }),
      });
      return;
    }

    if (url.endsWith(`/connections/${CONN}`) && method === "DELETE") {
      if (state.deleteBlocked) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "connection_attached_to_agent",
            agentId: AGENT_ID,
            agentName: "Support",
            message: "blocked",
          }),
        });
        return;
      }
      state.connections = [];
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
        body: JSON.stringify({
          connections: state.connections,
          events: [],
          canCreateConnection: true,
          connectionUnavailableReason: null,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

function connectionRow(overrides: Partial<ConnectionRow> = {}): ConnectionRow {
  return {
    id: CONN,
    display_name: "Savor CS Main",
    phone_number: "+60111111111",
    agent_config_id: null,
    mode: "live",
    status: "authorized",
    last_state_instance: "authorized",
    ...overrides,
  };
}

test.describe("Connection check and guarded delete", () => {
  // Happy path: the test button verifies the live session and tells the user the line is connected.
  test("test connection reports a live line", async ({ page }) => {
    const state: ConnectState = {
      connections: [connectionRow()],
      checkStatus: "connected",
      deleteBlocked: false,
    };
    await seedSession(page);
    await mockConnectApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/connect`);

    await expect(page.getByText("Authorized")).toBeVisible();
    await page.getByRole("button", { name: "Test connection" }).click();

    await expect(page.getByTestId("connection-test-ok")).toBeVisible();
    await expect(page.getByText("Authorized")).toBeVisible();
  });

  // Critical: a stale "Authorized" card whose session is really logged out must flip to Not Authorized
  // after the check, so users can reconnect instead of trusting a card that no longer works.
  test("test connection flips a stale card to Not Authorized", async ({ page }) => {
    const state: ConnectState = {
      connections: [connectionRow()],
      checkStatus: "disconnected",
      deleteBlocked: false,
    };
    await seedSession(page);
    await mockConnectApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/connect`);

    await expect(page.getByText("Authorized")).toBeVisible();
    await page.getByRole("button", { name: "Test connection" }).click();

    await expect(page.getByText("Not Authorized")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconnect QR" })).toBeVisible();
    // The card's own offline note explains the state — the button must not repeat it.
    await expect(page.getByText(/This WhatsApp connection is offline/)).toBeVisible();
    await expect(page.getByText(/This connection is offline\. Reconnect with a new QR\./)).toHaveCount(0);
  });

  // Critical: deleting a live line that an agent replies on is blocked — the dialog shows the fresh
  // live status, names the agent, links to detach it, and keeps Delete unavailable.
  test("delete is blocked when a live line is attached to an agent", async ({ page }) => {
    const state: ConnectState = {
      connections: [connectionRow({ agent_config_id: AGENT_ID })],
      checkStatus: "connected",
      deleteBlocked: true,
    };
    await seedSession(page);
    await mockConnectApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/connect`);

    await page.getByRole("button", { name: "Open connection actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Delete connection?")).toBeVisible();
    await expect(dialog.getByText("Connection status:")).toBeVisible();
    await expect(dialog.getByText("Live", { exact: true })).toBeVisible();
    await expect(page.getByTestId("connection-delete-agent")).toHaveText("Support");
    await expect(dialog.getByText(/still live and attached to agent/i)).toBeVisible();
    await expect(dialog.getByText(/This removes/)).toHaveCount(0);
    await page.getByLabel("About connection status").hover();
    await expect(page.getByRole("tooltip")).toContainText(
      "still connected to the user's phone",
    );
    await expect(dialog.getByRole("link", { name: "Open agent setup" })).toHaveAttribute(
      "href",
      `/${WORKSPACE_ID}/agent?agentId=${AGENT_ID}`,
    );
    await expect(dialog.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

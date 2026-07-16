import { test, expect, type Page, type Route } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const AGENT_ID = "agent-1";
const CONN_A = "conn-a";
const CONN_B = "conn-b";

type ConnectionRow = {
  id: string;
  display_name: string;
  phone_number: string | null;
  agent_config_id: string | null;
  mode: string;
  status: string;
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

function agentPayload(agentIdsWithConnection: string[]) {
  return {
    agents: [
      {
        id: AGENT_ID,
        profile_name: "Shared Agent",
        behavior: "Be helpful",
        tools: [],
        skills: [],
        response_template_groups: [],
        handoff_topic_groups: [],
        context_groups: [],
        asset_groups: [],
        auto_assign_conversation_labels: true,
      },
    ],
    agentIdsWithConnection,
    responseTemplateGroups: [],
    handoffTopicGroups: [],
    workspaceContextGroups: [],
    workspaceAssetGroups: [],
  };
}

async function mockCommonApis(
  page: Page,
  state: {
    connections: ConnectionRow[];
    lastPutBody: { current: Record<string, unknown> | null };
  },
) {
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

    if (url.includes("/agents") && method === "GET") {
      const attached = [
        ...new Set(
          state.connections
            .map((c) => c.agent_config_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(agentPayload(attached)),
      });
      return;
    }

    if (url.includes(`/agents/${AGENT_ID}`) && method === "PUT") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.lastPutBody.current = body;
      const ids = Array.isArray(body.attachedConnectionIds)
        ? (body.attachedConnectionIds as string[])
        : [];
      for (const conn of state.connections) {
        if (conn.agent_config_id === AGENT_ID && !ids.includes(conn.id)) {
          conn.agent_config_id = null;
        }
      }
      for (const id of ids) {
        const conn = state.connections.find((c) => c.id === id);
        if (conn) conn.agent_config_id = AGENT_ID;
      }
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

    if (url.includes("/skills") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      });
      return;
    }

    if (url.includes("/custom-tools") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tools: [] }),
      });
      return;
    }

    if (url.includes("/tasks") && method === "GET") {
      const agents = [
        {
          id: AGENT_ID,
          profile_name: "Shared Agent",
          connections: state.connections
            .filter((c) => c.agent_config_id === AGENT_ID)
            .map((c) => ({
              id: c.id,
              display_name: c.display_name,
              phone_number: c.phone_number,
            })),
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: [],
          agents,
          total: 0,
          page: 1,
          pageSize: 20,
        }),
      });
      return;
    }

    if (url.includes("/contacts") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ contacts: [], total: 0, page: 1, pageSize: 20 }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test.describe("Multi-connection agent attach", () => {
  // Happy path: user can attach two WhatsApp lines to one agent; Save sends both ids and both stay selected.
  test("attaches two connections to one agent", async ({ page }) => {
    const state = {
      connections: [
        {
          id: CONN_A,
          display_name: "Line A",
          phone_number: "+111",
          agent_config_id: null as string | null,
          mode: "inactive",
          status: "authorized",
        },
        {
          id: CONN_B,
          display_name: "Line B",
          phone_number: "+222",
          agent_config_id: null as string | null,
          mode: "inactive",
          status: "authorized",
        },
      ],
      lastPutBody: { current: null as Record<string, unknown> | null },
    };
    await seedSession(page);
    await mockCommonApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/agent?agentId=${AGENT_ID}&tab=profile`);

    await expect(page.getByText("Line A")).toBeVisible();
    await expect(page.getByText("Line B")).toBeVisible();

    await page.getByRole("checkbox", { name: /Line A/i }).check();
    await page.getByRole("checkbox", { name: /Line B/i }).check();
    await page.getByRole("button", { name: /^Save$/ }).click();

    await expect.poll(() => state.lastPutBody.current).not.toBeNull();
    const ids = state.lastPutBody.current?.attachedConnectionIds as string[];
    expect(ids).toEqual(expect.arrayContaining([CONN_A, CONN_B]));
    expect(ids).toHaveLength(2);

    await expect(page.getByRole("checkbox", { name: /Line A/i })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Line B/i })).toBeChecked();
  });

  // Critical: adding a second line must keep the first in the PUT payload (no clear-then-set-one wipe).
  test("save keeps existing sibling connection when attaching another", async ({ page }) => {
    const state = {
      connections: [
        {
          id: CONN_A,
          display_name: "Line A",
          phone_number: "+111",
          agent_config_id: AGENT_ID as string | null,
          mode: "live",
          status: "authorized",
        },
        {
          id: CONN_B,
          display_name: "Line B",
          phone_number: "+222",
          agent_config_id: null as string | null,
          mode: "inactive",
          status: "authorized",
        },
      ],
      lastPutBody: { current: null as Record<string, unknown> | null },
    };
    await seedSession(page);
    await mockCommonApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/agent?agentId=${AGENT_ID}&tab=profile`);

    await expect(page.getByRole("checkbox", { name: /Line A/i })).toBeChecked();
    await page.getByRole("checkbox", { name: /Line B/i }).check();
    await page.getByRole("button", { name: /^Save$/ }).click();

    await expect.poll(() => state.lastPutBody.current).not.toBeNull();
    const ids = state.lastPutBody.current?.attachedConnectionIds as string[];
    expect(ids).toEqual(expect.arrayContaining([CONN_A, CONN_B]));
    expect(ids).toHaveLength(2);
  });

  // Critical: with two attached lines, create-task requires choosing a connection; with one, create works without an extra pick.
  test("task create requires connection when agent has multiple lines", async ({ page }) => {
    const multiState = {
      connections: [
        {
          id: CONN_A,
          display_name: "Line A",
          phone_number: "+111",
          agent_config_id: AGENT_ID as string | null,
          mode: "live",
          status: "authorized",
        },
        {
          id: CONN_B,
          display_name: "Line B",
          phone_number: "+222",
          agent_config_id: AGENT_ID as string | null,
          mode: "testing",
          status: "authorized",
        },
      ],
      lastPutBody: { current: null as Record<string, unknown> | null },
    };
    await seedSession(page);
    await mockCommonApis(page, multiState);
    await page.goto(`/${WORKSPACE_ID}/tasks`);

    await page.getByRole("button", { name: /Create task|New task/i }).click();
    await expect(page.getByLabel(/WhatsApp connection|Connection/i)).toBeVisible();
    const createBtn = page.getByRole("button", { name: /Create task/i });
    await expect(createBtn).toBeDisabled();

    await page.getByLabel(/WhatsApp connection|Connection/i).selectOption(CONN_A);
    await expect(createBtn).toBeEnabled();
  });
});

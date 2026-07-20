import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const AGENT_ID = "agent-e2e-1";

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
  state: {
    notifyUserIds: string[];
    recipients: Array<{ userId: string; email: string; phone: string; status: string }>;
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

    if (url.match(/\/team\/?(\?.*)?$/) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          members: state.recipients.map((r) => ({
            id: r.userId,
            userId: r.userId,
            email: r.email,
            role: "owner",
            joined_at: "2026-01-01T00:00:00.000Z",
            handoffPhones:
              r.status === "verified"
                ? [
                    {
                      connectionId: "conn-e2e-1",
                      connectionName: "Ops Line",
                      phone: r.phone,
                      status: "verified",
                    },
                  ]
                : [],
          })),
        }),
      });
      return;
    }

    if (url.includes(`/agents/${AGENT_ID}`) && method === "PUT") {
      const body = route.request().postDataJSON() as { handoffNotifyUserIds?: string[] };
      state.notifyUserIds = Array.isArray(body.handoffNotifyUserIds) ? body.handoffNotifyUserIds : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (url.match(/\/agents\/?(\?.*)?$/) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          agents: [
            {
              id: AGENT_ID,
              profile_name: "Notify Agent",
              behavior: "",
              tools: [],
              skills: [],
              updated_at: "2026-01-01T00:00:00.000Z",
              first_used_at: null,
              auto_assign_conversation_labels: true,
              response_template_groups: [],
              handoff_topic_groups: ["hg-e2e-1"],
              context_groups: [],
              asset_groups: [],
              handoff_notify_user_ids: state.notifyUserIds,
            },
          ],
          agentIdsWithConnection: [],
          tools: [],
          skills: [],
          responseTemplateGroups: [],
          handoffTopicGroups: [
            {
              id: "hg-e2e-1",
              name: "General Hand off",
              updated_at: "2026-01-01T00:00:00.000Z",
              entry_count: 0,
            },
          ],
          workspaceContextGroups: [],
          workspaceAssetGroups: [],
        }),
      });
      return;
    }

    if (url.includes("/handoff-topic-groups/hg-e2e-1") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          group: {
            id: "hg-e2e-1",
            name: "General Hand off",
            updated_at: "2026-01-01T00:00:00.000Z",
            entries: [],
          },
        }),
      });
      return;
    }

    if (url.includes("/whatsapp/connections")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          connections: [],
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

test.describe("Agent handoff notify", () => {
  // Happy path: choose verified teammates and save notify targets.
  test("selects notify people and saves", async ({ page }) => {
    const state = {
      notifyUserIds: [] as string[],
      recipients: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          email: "ops@senqo.app",
          phone: "15551234567",
          status: "verified",
        },
        {
          userId: "22222222-2222-4222-8222-222222222222",
          email: "desk@senqo.app",
          phone: "15557654321",
          status: "verified",
        },
      ],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/agent?tab=handoff&agentId=${AGENT_ID}`);
    await page.getByRole("button", { name: "Handoff settings" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /Handoff settings · General Hand off/i }),
    ).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "Notify Agent" })).toBeChecked();
    await dialog.getByRole("checkbox", { name: /ops@senqo.app/ }).check();
    await dialog.getByRole("checkbox", { name: /desk@senqo.app/ }).check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Handoff settings saved.")).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(state.notifyUserIds).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  // Empty verified list points to Team settings.
  test("empty notify list links to Team settings", async ({ page }) => {
    const state = { notifyUserIds: [] as string[], recipients: [] };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/agent?tab=handoff&agentId=${AGENT_ID}`);
    await page.getByRole("button", { name: "Handoff settings" }).click();

    await expect(
      page.getByRole("dialog").getByRole("link", { name: /Settings → Team/i }),
    ).toBeVisible();
  });

  // Changing notify selection enables Save in the group-scoped dialog.
  test("enables Save after changing notify checkboxes", async ({ page }) => {
    const state = {
      notifyUserIds: [] as string[],
      recipients: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          email: "ops@senqo.app",
          phone: "15551234567",
          status: "verified",
        },
      ],
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto(`/${WORKSPACE_ID}/agent?tab=handoff&agentId=${AGENT_ID}`);
    await page.getByRole("button", { name: "Handoff settings" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Save" })).toHaveCount(0);
    await dialog.getByRole("checkbox", { name: /ops@senqo.app/ }).check();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});

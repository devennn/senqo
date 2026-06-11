import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const TOOL_ID = "tool-e2e-1";

const TOOL_SOURCE = `export async function execute(
  input: { mode: "alpha" | "beta", count?: number },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  return { ok: true, mode: input.mode };
}`;

type ToolDetail = {
  id: string;
  workspace_id: string;
  tool_key: string;
  display_name: string;
  description: string;
  required_env: string[];
  is_active: boolean;
  source_hash: string;
  source_code: string;
  input_schema: Record<string, unknown>;
  test_input: string;
  created_at: string;
  updated_at: string;
};

function createToolDetail(overrides: Partial<ToolDetail> = {}): ToolDetail {
  return {
    id: TOOL_ID,
    workspace_id: WORKSPACE_ID,
    tool_key: "sample_tool",
    display_name: "Sample Tool",
    description: "Demo tool for E2E",
    required_env: [],
    is_active: true,
    source_hash: "e2e-hash",
    source_code: TOOL_SOURCE,
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["alpha", "beta"], minLength: 1 },
        count: { type: "number" },
      },
      required: ["mode"],
      additionalProperties: false,
    },
    test_input: '{\n  "mode": "alpha"\n}',
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "senqo_auth",
      JSON.stringify({ accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" }),
    );
    localStorage.setItem("senqo_active_workspace", JSON.stringify("ws-1"));
  });
}

async function mockApis(page: Page, toolState: { current: ToolDetail }) {
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

    if (url.match(/\/custom-tools\/?(\?.*)?$/) && method === "GET") {
      const { current } = toolState;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tools: [
            {
              id: current.id,
              workspace_id: current.workspace_id,
              tool_key: current.tool_key,
              display_name: current.display_name,
              description: current.description,
              required_env: current.required_env,
              is_active: current.is_active,
              source_hash: current.source_hash,
              created_at: current.created_at,
              updated_at: current.updated_at,
            },
          ],
        }),
      });
      return;
    }

    if (url.includes(`/custom-tools/${TOOL_ID}`) && method === "GET" && !url.includes("/test")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tool: toolState.current }),
      });
      return;
    }

    if (url.includes(`/custom-tools/${TOOL_ID}`) && method === "PUT") {
      const body = route.request().postDataJSON() as {
        displayName?: string;
        description?: string;
        testInput?: string;
      };
      toolState.current = {
        ...toolState.current,
        display_name: body.displayName ?? toolState.current.display_name,
        description: body.description ?? toolState.current.description,
        test_input: body.testInput ?? toolState.current.test_input,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (url.includes("/secrets") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ secrets: [] }),
      });
      return;
    }

    if (url.includes("/agents") && method === "GET") {
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

    if (url.includes("/skills") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      });
      return;
    }

    if (url.includes("/connections") && method === "GET") {
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

async function openToolEditor(page: Page) {
  await page.goto(`/${WORKSPACE_ID}/agent?tab=tools&toolId=${TOOL_ID}`);
  await expect(page.getByRole("tab", { name: "Tool Catalog" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Sample Tool$/ })).toBeVisible();
}

test.describe("Custom tools catalog", () => {
  // Happy path: opening a tool in the editor shows the tool name, description, and a disabled Save button (clean state).
  test("opens selected tool in editor with clean save state", async ({ page }) => {
    const toolState = { current: createToolDetail() };
    await seedSession(page);
    await mockApis(page, toolState);
    await openToolEditor(page);

    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
    const fields = page.getByRole("textbox");
    await expect(fields.nth(0)).toHaveValue("Sample Tool");
    await expect(fields.nth(1)).toHaveValue("Demo tool for E2E");
  });

  // Save button must be disabled initially, enabled after edits, and disabled again after a successful save with cleared dirty state.
  test("enables Save changes only after edits and clears dirty after save", async ({ page }) => {
    const toolState = { current: createToolDetail() };
    await seedSession(page);
    await mockApis(page, toolState);
    await openToolEditor(page);

    const saveButton = page.getByRole("button", { name: "Save changes" });
    await expect(saveButton).toBeDisabled();

    await page.getByRole("textbox").nth(1).fill("Updated description");
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect(saveButton).toBeDisabled();
    await expect(page.getByRole("textbox").nth(1)).toHaveValue("Updated description");
  });

  // Editing the test input JSON must enable Save, and the edited value must persist in the UI after saving.
  test("treats test input JSON edits as unsaved until Save changes", async ({ page }) => {
    const toolState = { current: createToolDetail() };
    await seedSession(page);
    await mockApis(page, toolState);
    await openToolEditor(page);

    const saveButton = page.getByRole("button", { name: "Save changes" });
    const testInputField = page.locator("textarea.font-mono.text-xs");

    await testInputField.fill('{\n  "mode": "beta",\n  "count": 2\n}');
    await expect(saveButton).toBeEnabled();

    await saveButton.click();
    await expect(saveButton).toBeDisabled();
    await expect(testInputField).toHaveValue('{\n  "mode": "beta",\n  "count": 2\n}');
  });
});

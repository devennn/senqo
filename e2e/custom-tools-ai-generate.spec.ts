import { test, expect, type Page } from "@playwright/test";

const WORKSPACE_ID = "ws-1";

const GENERATED_SOURCE = `export async function execute(
  input: { city: string },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  const key = ctx.env.WEATHER_API_KEY;
  const res = await fetch(\`https://example.com/weather?city=\${encodeURIComponent(input.city)}&key=\${key}\`);
  return { ok: res.ok, city: input.city };
}`;

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
  options?: {
    generateHandler?: (route: import("@playwright/test").Route) => Promise<void>;
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

    if (url.match(/\/custom-tools\/generate\/?$/) && method === "POST") {
      if (options?.generateHandler) {
        await options.generateHandler(route);
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          displayName: "Get City Weather",
          description: "Fetch weather for a city using the Weather API.",
          sourceCode: GENERATED_SOURCE,
          requiredEnv: ["WEATHER_API_KEY"],
        }),
      });
      return;
    }

    if (url.match(/\/custom-tools\/?(\?.*)?$/) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tools: [] }),
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

async function openCreateTool(page: Page) {
  await page.goto(`/${WORKSPACE_ID}/agent?tab=tools&mode=new`);
  await expect(page.getByRole("tab", { name: "Tool Catalog" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Create tool$/ })).toBeVisible();
}

test.describe("Custom tools AI generate", () => {
  // Happy path: open Generate with AI, paste a reference, generate, and the create form is filled.
  test("fills create form from AI generate", async ({ page }) => {
    await seedSession(page);
    await mockApis(page);
    await openCreateTool(page);

    await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
    await page
      .getByLabel("Reference or instructions")
      .fill("OpenWeather API: GET /weather?q={city}&appid={KEY}. Return temp and description.");
    await page.getByRole("button", { name: "Generate", exact: true }).click();

    await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Get City Weather");
    await expect(page.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(
      "Fetch weather for a city using the Weather API.",
    );
    await expect(page.getByRole("textbox", { name: "Required env names", exact: true })).toHaveValue(
      "WEATHER_API_KEY",
    );
    await expect(page.getByText("export async function execute")).toBeVisible();
    await expect(page.getByText("example.com/weather")).toBeVisible();
  });

  // Generate stays disabled until the reference textarea has text so empty requests are not sent.
  test("disables Generate until reference text is entered", async ({ page }) => {
    await seedSession(page);
    await mockApis(page);
    await openCreateTool(page);

    await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
    const generateButton = page.getByRole("button", { name: "Generate", exact: true });
    await expect(generateButton).toBeDisabled();

    await page.getByLabel("Reference or instructions").fill("Call my CRM API to look up a contact by phone.");
    await expect(generateButton).toBeEnabled();
  });

  // When generate fails, show an error in the dialog and leave the form fields unchanged.
  test("shows error when AI generate fails", async ({ page }) => {
    await seedSession(page);
    await mockApis(page, {
      generateHandler: async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "generate_failed",
            message: "Could not generate tool code.",
          }),
        });
      },
    });
    await openCreateTool(page);

    await page.getByRole("button", { name: "Generate with AI", exact: true }).click();
    await page.getByLabel("Reference or instructions").fill("Broken API docs");
    await page.getByRole("button", { name: "Generate", exact: true }).click();

    await expect(page.getByText("Could not generate tool code.")).toBeVisible();
    await expect(page.locator("#tool-create-name")).toHaveValue("My Custom Tool");
  });
});

import { test, expect, type Page } from "@playwright/test";

const AUTH_USER = { id: "admin-user-1", email: "admin@company.com" };
const ACCESS_TOKEN = "admin-ai-access-token";
const REFRESH_TOKEN = "admin-ai-refresh-token";

type StoredMessage = { id: string; role: "user" | "assistant"; content: string; created_at: string };

let chatMessages: StoredMessage[] = [];
let chatFailure: { status: number; error: string } | null = null;

async function seedAuthTokens(page: Page) {
  await page.addInitScript(([accessToken, refreshToken]) => {
    localStorage.setItem("senqo_auth", JSON.stringify({ accessToken, refreshToken }));
  }, [ACCESS_TOKEN, REFRESH_TOKEN]);
}

async function mockAuthApi(page: Page) {
  await page.route("**/api/auth/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.endsWith("/session") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { ...AUTH_USER, isInstanceAdmin: true },
          isInstanceAdmin: true,
        }),
      });
      return;
    }

    if (url.endsWith("/refresh") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: ACCESS_TOKEN,
          refreshToken: REFRESH_TOKEN,
          user: { ...AUTH_USER, isInstanceAdmin: true },
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function mockWorkspaceApi(page: Page) {
  await page.route("**/api/user/workspaces**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ workspaces: [] }),
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
        body: JSON.stringify({ workspaces: [] }),
      });
      return;
    }

    if (url.endsWith("/users") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: [], pendingInvites: [] }),
      });
      return;
    }

    if (url.endsWith("/ai/messages") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: chatMessages }),
      });
      return;
    }

    if (url.endsWith("/ai/chat") && method === "POST") {
      if (chatFailure) {
        await route.fulfill({
          status: chatFailure.status,
          contentType: "application/json",
          body: JSON.stringify({ error: chatFailure.error }),
        });
        return;
      }
      const body = route.request().postDataJSON() as { message?: string };
      const reply = `You asked: ${body.message ?? ""}`;
      chatMessages.push({
        id: `user-${chatMessages.length}`,
        role: "user",
        content: body.message ?? "",
        created_at: "2026-10-29T08:00:00.000Z",
      });
      chatMessages.push({
        id: `assistant-${chatMessages.length}`,
        role: "assistant",
        content: reply,
        created_at: "2026-10-29T08:00:05.000Z",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply }),
      });
      return;
    }

    if (url.endsWith("/ai/messages") && method === "DELETE") {
      chatMessages = [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test.describe("Admin AI chat", () => {
  // Happy path: an instance admin opens the admin page, asks a question, and
  // sees the assistant reply appended to the chat.
  test("admin sends a question and sees the assistant reply", async ({ page }) => {
    await seedAuthTokens(page);
    await mockAuthApi(page);
    await mockWorkspaceApi(page);
    await mockAdminApi(page);

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Instance admin" })).toBeVisible();
    await expect(page.getByText("AI assistant")).toBeVisible();

    await page.getByLabel("Message").fill("How many workspaces do I have?");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("You asked: How many workspaces do I have?")).toBeVisible();
  });

  // When the agent returns no reply, the failed question is removed and an
  // error is shown — the chat must never pretend an answer was given.
  test("shows an error and drops the question when the agent fails", async ({ page }) => {
    await seedAuthTokens(page);
    await mockAuthApi(page);
    await mockWorkspaceApi(page);
    await mockAdminApi(page);

    await page.goto("/admin");

    await expect(page.getByText("AI assistant")).toBeVisible();

    const failure = { status: 502, error: "empty_reply" };
    await page.route("**/api/admin/ai/chat", async (route) => {
      await route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: JSON.stringify({ error: failure.error }),
      });
    });

    await page.getByLabel("Message").fill("How many users do I have?");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("empty reply")).toBeVisible();
    await expect(page.getByText("How many users do I have?")).toHaveCount(0);
  });

  // Clear chat empties the conversation so the admin can start over.
  test("clear chat empties the conversation", async ({ page }) => {
    await seedAuthTokens(page);
    await mockAuthApi(page);
    await mockWorkspaceApi(page);
    await mockAdminApi(page);

    await page.goto("/admin");

    await expect(page.getByText("AI assistant")).toBeVisible();

    await page.getByLabel("Message").fill("Hello there");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("You asked: Hello there")).toBeVisible();

    await page.getByRole("button", { name: "Clear chat" }).click();

    await expect(page.getByText("You asked: Hello there")).toHaveCount(0);
  });
});

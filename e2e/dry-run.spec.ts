import { test, expect, type Page, type Route } from "@playwright/test";

const WORKSPACE_ID = "ws-1";
const CONVERSATION_ID = "conv-1";
const CONNECTION_ID = "conn-1";

type ConnectionRow = {
  id: string;
  display_name: string;
  phone_number: string | null;
  agent_config_id: string | null;
  mode: string;
  status: string;
  last_state_instance: string | null;
};

type ThreadState = {
  connections: ConnectionRow[];
  messages: Array<Record<string, unknown>>;
  patchedModes: string[];
};

function conversationHeader(mode: string) {
  return {
    id: CONVERSATION_ID,
    title: "Aina",
    status: "open",
    handlingMode: "ai",
    connectionAiEnabled: true,
    canSendManualWhatsapp: true,
    isGroup: false,
    whatsappChatId: "60123456789@s.whatsapp.net",
    whatsappConnection: {
      id: CONNECTION_ID,
      displayName: "Savor CS Main",
      phoneNumber: "+60111111111",
      mode,
    },
    group: null,
    labels: [],
    contact: {
      firstName: "Aina",
      lastName: "",
      phone: "60123456789",
      avatarUrl: null,
    },
  };
}

function conversationSummary() {
  return {
    id: CONVERSATION_ID,
    title: "Aina",
    status: "open",
    handlingMode: "ai",
    isGroup: false,
    whatsappChatId: "60123456789@s.whatsapp.net",
    whatsappConnection: {
      id: CONNECTION_ID,
      displayName: "Savor CS Main",
      phoneNumber: "+60111111111",
    },
    group: null,
    labels: [],
    updated_at: "2026-10-14T10:00:05.000Z",
    contact: { firstName: "Aina", lastName: "", phone: "60123456789", avatarUrl: null },
    lastMessage: {
      content: "Do you deliver to Subang?",
      createdAt: "2026-10-14T10:00:00.000Z",
      isOutbound: false,
    },
  };
}

function inboundMessage(): Record<string, unknown> {
  return {
    id: "msg-1",
    role: "user",
    content: "Do you deliver to Subang?",
    created_at: "2026-10-14T10:00:00.000Z",
    metadata: {},
    outgoing_sender_type: null,
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
  };
}

function draftMessage(): Record<string, unknown> {
  return {
    id: "msg-2",
    role: "assistant",
    content: "Yes, we deliver to Subang — same-day before 4pm.",
    created_at: "2026-10-14T10:00:05.000Z",
    metadata: { source: "agent_dry_run", dry_run: true },
    outgoing_sender_type: "ai_agent",
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
  };
}

function wouldHandOffMessage(): Record<string, unknown> {
  return {
    id: "msg-3",
    role: "assistant",
    content: "Human handoff",
    created_at: "2026-10-14T10:00:06.000Z",
    metadata: {
      thread_event: "handoff_to_human",
      handoff_tool_reason: "Customer asked for a person",
      dry_run: true,
    },
    outgoing_sender_type: null,
    whatsapp_sender_chat_id: null,
    whatsapp_sender_name: null,
    media: null,
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

async function mockApis(page: Page, state: ThreadState) {
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

    if (url.endsWith(`/connections/${CONNECTION_ID}/mode`) && method === "PATCH") {
      const body = route.request().postDataJSON() as { mode: string };
      state.patchedModes.push(body.mode);
      state.connections = state.connections.map((conn) =>
        conn.id === CONNECTION_ID ? { ...conn, mode: body.mode } : conn,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mode: body.mode }),
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

    if (url.includes("/conversation-labels")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ labels: [] }),
      });
      return;
    }

    if (url.includes(`/conversations/${CONVERSATION_ID}/messages`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], hasMoreOlderMessages: false }),
      });
      return;
    }

    if (url.includes(`/conversations/${CONVERSATION_ID}`) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversation: conversationHeader(state.connections[0]?.mode ?? "dry_run"),
          messages: state.messages,
          hasMoreOlderMessages: false,
        }),
      });
      return;
    }

    if (url.includes("/conversations") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ conversations: [conversationSummary()], hasMore: false, total: 1 }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

function connectionRow(overrides: Partial<ConnectionRow> = {}): ConnectionRow {
  return {
    id: CONNECTION_ID,
    display_name: "Savor CS Main",
    phone_number: "+60111111111",
    agent_config_id: null,
    mode: "inactive",
    status: "authorized",
    last_state_instance: "authorized",
    ...overrides,
  };
}

test.describe("Dry runs", () => {
  // Happy path: while the line is in Dry run, the AI reply appears in the thread
  // labeled "not sent" — admins must never mistake a draft for a delivered reply.
  test("thread shows a dry-run draft labeled as not sent", async ({ page }) => {
    const state: ThreadState = {
      connections: [connectionRow({ mode: "dry_run" })],
      messages: [inboundMessage(), draftMessage()],
      patchedModes: [],
    };
    await seedSession(page);
    await mockApis(page, state);

    await page.goto(`/${WORKSPACE_ID}/dashboard?conversationId=${CONVERSATION_ID}`);

    await expect(page.getByText("Dry run · Not sent")).toBeVisible();
    await expect(
      page.getByText("Yes, we deliver to Subang — same-day before 4pm."),
    ).toBeVisible();
    await expect(
      page.getByText("Dry run — AI replies are drafted here but not sent to the customer."),
    ).toBeVisible();
  });

  // A would-hand-off decision during a dry run must be visible to operators as a
  // dry-run note, because the live conversation did not actually switch to human.
  test("thread shows a dry-run would-hand-off note", async ({ page }) => {
    const state: ThreadState = {
      connections: [connectionRow({ mode: "dry_run" })],
      messages: [inboundMessage(), wouldHandOffMessage()],
      patchedModes: [],
    };
    await seedSession(page);
    await mockApis(page, state);

    await page.goto(`/${WORKSPACE_ID}/dashboard?conversationId=${CONVERSATION_ID}`);

    await expect(page.getByText("Dry run · would hand off")).toBeVisible();
    await expect(page.getByText("Customer asked for a person")).toBeVisible();
  });

  // Critical: switching the line to Dry run persists dry_run so drafts start, and
  // the card reflects the new mode after reload.
  test("connect card switches a line to Dry run", async ({ page }) => {
    const state: ThreadState = {
      connections: [connectionRow({ mode: "inactive" })],
      messages: [],
      patchedModes: [],
    };
    await seedSession(page);
    await mockApis(page, state);

    await page.goto(`/${WORKSPACE_ID}/connect`);

    await page.getByRole("button", { name: "Dry run", exact: true }).click();

    await expect
      .poll(() => state.patchedModes)
      .toEqual(["dry_run"]);
    await expect(
      page.getByRole("button", { name: "Dry run", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

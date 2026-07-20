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
  state: { member: TeamMember; failRegisterWith?: string },
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

    if (url.includes("/team/handoff-phone/confirm") && method === "POST") {
      const body = route.request().postDataJSON() as { whatsappConnectionId?: string; phone?: string };
      const existing = state.member.handoffPhones[0];
      state.member = {
        ...state.member,
        handoffPhones: [
          {
            connectionId: body.whatsappConnectionId ?? CONNECTION_ID,
            connectionName: "Ops Line",
            phone: existing?.phone ?? "60123456789",
            status: "verified",
          },
        ],
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (url.includes("/team/handoff-phone") && method === "POST") {
      if (state.failRegisterWith) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: state.failRegisterWith }),
        });
        return;
      }
      const body = route.request().postDataJSON() as {
        phone?: string;
        whatsappConnectionId?: string;
      };
      state.member = {
        ...state.member,
        handoffPhones: [
          {
            connectionId: body.whatsappConnectionId ?? CONNECTION_ID,
            connectionName: "Ops Line",
            phone: String(body.phone ?? "").replace(/\D/g, ""),
            status: "pending",
          },
        ],
      };
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
    ...overrides,
  };
}

test.describe("Handoff phone registration", () => {
  // Happy path: owner registers a phone on a line, enters OTP, and sees Verified.
  test("registers phone, confirms code, and shows Verified", async ({ page }) => {
    const state = { member: ownerMember() };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto("/settings/team");

    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await page.getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("WhatsApp line")).toBeVisible();
    await page.getByRole("textbox", { name: "Personal number" }).fill("60123456789");
    await page.getByRole("button", { name: "Send code" }).click();

    await expect(page.getByLabel("Code")).toBeVisible();
    await page.getByLabel("Code").fill("123456");
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByText("Verified")).toBeVisible();
  });

  // Confirm stays disabled until a code is entered so empty submits are blocked.
  test("keeps Confirm disabled until a confirmation code is entered", async ({ page }) => {
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
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto("/settings/team");
    await page.getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const confirmButton = page.getByRole("button", { name: "Confirm" });
    await expect(confirmButton).toBeDisabled();
    await page.getByLabel("Code").fill("123456");
    await expect(confirmButton).toBeEnabled();
  });

  // Missing authorized WhatsApp connection must surface a clear error after Send code.
  test("shows clear error when no WhatsApp connection can send the code", async ({ page }) => {
    const state = {
      member: ownerMember(),
      failRegisterWith: "no_whatsapp_connection",
    };
    await seedSession(page);
    await mockApis(page, state);
    await page.goto("/settings/team");
    await page.getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("textbox", { name: "Personal number" }).fill("60123456789");
    await page.getByRole("button", { name: "Send code" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/connect a WhatsApp line/i)).toBeVisible();
  });
});

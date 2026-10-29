import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});

vi.mock("./llm.js", () => ({
  getChatLLM: vi.fn(),
}));

vi.mock("../repositories/instance-settings.js", () => ({
  getAllowPublicRegistration: vi.fn(),
  setAllowPublicRegistration: vi.fn(),
}));

vi.mock("../repositories/workspaces.js", () => ({
  listAllWorkspaces: vi.fn(),
}));

vi.mock("../repositories/auth-users.js", () => ({
  listAllUsers: vi.fn(),
}));

vi.mock("../repositories/admin-chat.js", () => ({
  createAdminChatMessage: vi.fn(),
  listAdminChatMessages: vi.fn(),
}));

import { generateText } from "ai";
import {
  runAdminChat,
  persistAdminChatUserMessage,
  validateAdminChatInput,
} from "./admin-chat.js";
import { createAdminChatTools } from "./admin-chat-tools.js";
import { getAllowPublicRegistration, setAllowPublicRegistration } from "../repositories/instance-settings.js";
import { listAllWorkspaces } from "../repositories/workspaces.js";
import { listAllUsers } from "../repositories/auth-users.js";
import { createAdminChatMessage, listAdminChatMessages } from "../repositories/admin-chat.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateAdminChatInput", () => {
  it("accepts a non-empty message", () => {
    expect(validateAdminChatInput({ message: "Hi" })).toEqual({ ok: true, message: "Hi" });
  });

  it("rejects an empty message", () => {
    expect(validateAdminChatInput({ message: "   " }).ok).toBe(false);
  });

  it("rejects a message over the max length", () => {
    expect(validateAdminChatInput({ message: "x".repeat(4001) }).ok).toBe(false);
  });
});

describe("createAdminChatTools", () => {
  // The platform-state tool aggregates settings and counts so the model can
  // answer "how many users" questions without guessing.
  it("get_platform_state returns settings and counts", async () => {
    vi.mocked(getAllowPublicRegistration).mockResolvedValue(true);
    vi.mocked(listAllWorkspaces).mockResolvedValue([
      {
        id: "w1",
        name: "Acme",
        owner_user_id: "u1",
        owner_email: "owner@example.com",
        created_at: "2026-01-01T00:00:00.000Z",
        member_count: 2,
      },
    ]);
    vi.mocked(listAllUsers).mockResolvedValue([
      {
        id: "u1",
        email: "owner@example.com",
        created_at: "2026-01-01T00:00:00.000Z",
        is_instance_admin: true,
        disabled_at: null,
        owned_workspace_count: 1,
      },
      {
        id: "u2",
        email: "member@example.com",
        created_at: "2026-01-02T00:00:00.000Z",
        is_instance_admin: false,
        disabled_at: "2026-01-03T00:00:00.000Z",
        owned_workspace_count: 0,
      },
    ]);

    const tools = createAdminChatTools();
    const result = await tools.get_platform_state.execute!(
      {},
      { toolCallId: "tc-1", messages: [] },
    );

    expect(result).toEqual({
      allowPublicRegistration: true,
      workspaceCount: 1,
      userCount: 2,
      adminCount: 1,
      disabledUserCount: 1,
    });
  });

  // Toggling the registration setting returns ok so the model can confirm
  // the change to the admin.
  it("set_allow_public_registration persists the new value", async () => {
    vi.mocked(setAllowPublicRegistration).mockResolvedValue({ ok: true });

    const tools = createAdminChatTools();
    const execute = tools.set_allow_public_registration.execute!;
    const result = await execute({ allow: false }, { toolCallId: "t1", messages: [] });

    expect(setAllowPublicRegistration).toHaveBeenCalledWith(false);
    expect(result).toMatchObject({ ok: true });
  });
});

describe("runAdminChat", () => {
  // A successful model run persists the assistant reply and returns it.
  it("runAdminChat returns and stores the assistant reply", async () => {
    vi.mocked(listAdminChatMessages).mockResolvedValue([
      { id: "m1", role: "user", content: "Hello", created_at: "2026-01-01T00:00:00.000Z" },
    ]);
    vi.mocked(createAdminChatMessage).mockResolvedValue({
      id: "m2",
      role: "assistant",
      content: "Hi there",
      created_at: "2026-01-01T00:00:01.000Z",
    });
    vi.mocked(generateText).mockResolvedValue({ text: "Hi there" } as never);

    const result = await runAdminChat("admin-1", "Hello");

    expect(result).toEqual({ ok: true, reply: "Hi there" });
    expect(createAdminChatMessage).toHaveBeenCalledWith("admin-1", "assistant", "Hi there");
  });

  // An empty model reply is an error, not a blank message — the route must
  // surface a failure so the UI shows an error state.
  it("runAdminChat fails when the model returns an empty reply", async () => {
    vi.mocked(listAdminChatMessages).mockResolvedValue([]);
    vi.mocked(generateText).mockResolvedValue({ text: "" } as never);

    const result = await runAdminChat("admin-1", "Hello");

    expect(result).toEqual({ ok: false, message: "empty_reply" });
    expect(createAdminChatMessage).not.toHaveBeenCalled();
  });

  // The admin's question is stored before the model runs so it survives failures.
  it("persistAdminChatUserMessage stores the question as a user message", async () => {
    vi.mocked(createAdminChatMessage).mockResolvedValue({
      id: "m1",
      role: "user",
      content: "Hello",
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(await persistAdminChatUserMessage("admin-1", "Hello")).toBe(true);
    expect(createAdminChatMessage).toHaveBeenCalledWith("admin-1", "user", "Hello");
  });
});

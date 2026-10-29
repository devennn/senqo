import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/auth-jwt.js", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../repositories/auth-users.js", () => ({
  isInstanceAdmin: vi.fn(),
}));

vi.mock("../repositories/admin-chat.js", () => ({
  createAdminChatMessage: vi.fn(),
  listAdminChatMessages: vi.fn(),
  deleteAdminChatMessages: vi.fn(),
}));

vi.mock("../agent/admin-chat.js", () => ({
  ADMIN_CHAT_MAX_MESSAGE_LENGTH: 4000,
  persistAdminChatUserMessage: vi.fn(),
  runAdminChat: vi.fn(),
  validateAdminChatInput: vi.fn(),
}));

import app from "./admin-ai.js";
import { verifyToken } from "../lib/auth-jwt.js";
import { isInstanceAdmin } from "../repositories/auth-users.js";
import {
  listAdminChatMessages,
  deleteAdminChatMessages,
} from "../repositories/admin-chat.js";
import {
  persistAdminChatUserMessage,
  runAdminChat,
  validateAdminChatInput,
} from "../agent/admin-chat.js";

const AUTH = { Authorization: "Bearer admin-token" };
const JSON_HEADERS = { "Content-Type": "application/json" };

const SAMPLE_MESSAGE = { role: "user", content: "How many workspaces do I have?" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyToken).mockResolvedValue({ userId: "admin-1" });
  vi.mocked(isInstanceAdmin).mockResolvedValue(true);
  vi.mocked(validateAdminChatInput).mockImplementation(
    (payload: unknown) => {
      const parsed = (payload as { message?: unknown } | null)?.message;
      return typeof parsed === "string" && parsed.trim().length > 0
        ? { ok: true, message: parsed }
        : { ok: false };
    },
  );
});

describe("GET /messages", () => {
  // Chat history exists for this admin → it is returned oldest-first so the UI
  // can render the conversation in order.
  it("GET /messages → returns stored chat messages", async () => {
    vi.mocked(listAdminChatMessages).mockResolvedValue([SAMPLE_MESSAGE]);

    const res = await app.request("/messages", { headers: AUTH });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ messages: [SAMPLE_MESSAGE] });
    expect(listAdminChatMessages).toHaveBeenCalledWith("admin-1", 200);
  });

  // A non-admin authenticated user → 403 is returned, needed so the admin
  // chat is only reachable by instance admins.
  it("GET /messages → returns 403 for a non-admin user", async () => {
    vi.mocked(isInstanceAdmin).mockResolvedValue(false);

    const res = await app.request("/messages", { headers: AUTH });

    expect(res.status).toBe(403);
  });

  // The request has no token → 401 is returned, needed so chat history is
  // never reachable unauthenticated.
  it("GET /messages → returns 401 without a token", async () => {
    const res = await app.request("/messages");

    expect(res.status).toBe(401);
  });
});

describe("POST /chat", () => {
  // A valid question is persisted and answered by the admin chat agent.
  it("POST /chat → returns the assistant reply", async () => {
    vi.mocked(persistAdminChatUserMessage).mockResolvedValue(true);
    vi.mocked(runAdminChat).mockResolvedValue({ ok: true, reply: "You have 3 workspaces." });

    const res = await app.request("/chat", {
      method: "POST",
      headers: { ...AUTH, ...JSON_HEADERS },
      body: JSON.stringify({ message: "How many workspaces do I have?" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "You have 3 workspaces." });
    expect(persistAdminChatUserMessage).toHaveBeenCalledWith(
      "admin-1",
      "How many workspaces do I have?",
    );
    expect(runAdminChat).toHaveBeenCalledWith("admin-1", "How many workspaces do I have?");
  });

  // Empty or missing message payload → 400 is returned so bad UI input never
  // reaches the agent.
  it("POST /chat → returns 400 for an invalid payload", async () => {
    const res = await app.request("/chat", {
      method: "POST",
      headers: { ...AUTH, ...JSON_HEADERS },
      body: JSON.stringify({ message: "" }),
    });

    expect(res.status).toBe(400);
    expect(runAdminChat).not.toHaveBeenCalled();
  });

  // The question could not be persisted → 500 is returned instead of silently
  // losing the admin's message.
  it("POST /chat → returns 500 when persisting the question fails", async () => {
    vi.mocked(persistAdminChatUserMessage).mockResolvedValue(false);

    const res = await app.request("/chat", {
      method: "POST",
      headers: { ...AUTH, ...JSON_HEADERS },
      body: JSON.stringify({ message: "Hello" }),
    });

    expect(res.status).toBe(500);
    expect(runAdminChat).not.toHaveBeenCalled();
  });

  // The agent failed to produce a reply → 502 is returned so the UI can show
  // an error instead of an empty answer.
  it("POST /chat → returns 502 when the agent returns no reply", async () => {
    vi.mocked(persistAdminChatUserMessage).mockResolvedValue(true);
    vi.mocked(runAdminChat).mockResolvedValue({ ok: false, message: "empty_reply" });

    const res = await app.request("/chat", {
      method: "POST",
      headers: { ...AUTH, ...JSON_HEADERS },
      body: JSON.stringify({ message: "Hello" }),
    });

    expect(res.status).toBe(502);
  });
});

describe("DELETE /messages", () => {
  // The admin clears the chat → stored messages are deleted and ok is returned.
  it("DELETE /messages → deletes stored chat messages", async () => {
    vi.mocked(deleteAdminChatMessages).mockResolvedValue({ ok: true });

    const res = await app.request("/messages", { method: "DELETE", headers: AUTH });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleteAdminChatMessages).toHaveBeenCalledWith("admin-1");
  });

  // The delete failed in the repository → 500 is returned so the UI does not
  // clear the chat on a failed request.
  it("DELETE /messages → returns 500 when the delete fails", async () => {
    vi.mocked(deleteAdminChatMessages).mockResolvedValue({ ok: false, message: "unexpected_error" });

    const res = await app.request("/messages", { method: "DELETE", headers: AUTH });

    expect(res.status).toBe(500);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockGetConversation = vi.fn();
const mockGetPhone = vi.fn();
const mockGetConnectionRow = vi.fn();
const mockListConnections = vi.fn();
const mockGetWorkspace = vi.fn();
const mockSendText = vi.fn();

vi.mock("../repositories/agent.js", () => ({
  getAgentConfigById: (...args: unknown[]) => mockGetAgent(...args),
}));

vi.mock("../repositories/conversations.js", () => ({
  getConversationWithContact: (...args: unknown[]) => mockGetConversation(...args),
}));

vi.mock("../repositories/handoff-phones.js", () => ({
  getHandoffPhone: (...args: unknown[]) => mockGetPhone(...args),
}));

vi.mock("../repositories/workspaces.js", () => ({
  getWorkspaceRow: (...args: unknown[]) => mockGetWorkspace(...args),
}));

vi.mock("../repositories/whatsapp.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/whatsapp.js")>();
  return {
    ...actual,
    getWhatsappConnectionRowById: (...args: unknown[]) => mockGetConnectionRow(...args),
    listConnections: (...args: unknown[]) => mockListConnections(...args),
  };
});

vi.mock("./whatsapp-client.js", () => ({
  sendTextMessageCompat: (...args: unknown[]) => mockSendText(...args),
}));

vi.mock("../lib/env.js", () => ({
  env: { frontendUrl: "https://app.example.com" },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConversation.mockResolvedValue({
    id: "conv-1",
    whatsappConnection: { id: "conn-1", displayName: "Main WhatsApp", phoneNumber: "1" },
    contact: { firstName: "Ada", lastName: "Lovelace", phone: "19998887777" },
  });
  mockGetConnectionRow.mockResolvedValue({ agent_config_id: "agent-1" });
  mockListConnections.mockResolvedValue([{ id: "conn-1", status: "authorized" }]);
  mockGetWorkspace.mockResolvedValue({ name: "Acme Workspace" });
  mockSendText.mockResolvedValue({ messageId: "m1" });
});

describe("buildHandoffAlertText", () => {
  // Headline leads with reason; phone/line/workspace + open URL help the teammate find the chat.
  it("puts reason in the headline and includes phone, line, and open URL", async () => {
    const { buildHandoffAlertText } = await import("./handoff-notify.js");
    const text = buildHandoffAlertText({
      workspaceName: "Acme Workspace",
      workspaceId: "ws-1",
      conversationId: "conv-1",
      contactPhone: "19998887777",
      lineName: "Main WhatsApp",
      reason: "Billing dispute",
      frontendBaseUrl: "https://app.example.com/",
    });

    expect(text).toBe(
      [
        "Senqo handoff: Billing dispute",
        "",
        "Phone: +19998887777",
        "Line: Main WhatsApp",
        "Workspace: Acme Workspace",
        "",
        "Open in Senqo:",
        "https://app.example.com/ws-1/dashboard?conversationId=conv-1&humanOnly=1",
      ].join("\n"),
    );
  });

  // No reason → generic headline; omit phone/line when missing.
  it("uses a generic headline when reason is empty", async () => {
    const { buildHandoffAlertText } = await import("./handoff-notify.js");
    const text = buildHandoffAlertText({
      workspaceName: "Acme",
      workspaceId: "ws-1",
      conversationId: "conv-1",
      contactPhone: null,
      lineName: null,
      reason: null,
      frontendBaseUrl: "https://app.example.com",
    });

    expect(text.startsWith("Senqo handoff: needs a human\n")).toBe(true);
    expect(text).not.toContain("Phone:");
    expect(text).not.toContain("Line:");
    expect(text).not.toContain("Customer:");
  });

  // Regression: never put unreliable contact names (often JIDs with @) in the alert.
  it("never includes a Customer name line", async () => {
    const { buildHandoffAlertText } = await import("./handoff-notify.js");
    const text = buildHandoffAlertText({
      workspaceName: "Acme",
      workspaceId: "ws-1",
      conversationId: "conv-1",
      contactPhone: "15551234567",
      lineName: "Main",
      reason: "Help",
      frontendBaseUrl: "https://app.example.com",
    });
    expect(text).not.toMatch(/Customer:/i);
    expect(text).not.toContain("@");
  });
});

describe("buildHandoffConversationOpenUrl", () => {
  // Deep link must open dashboard on the conversation with human-only filter.
  it("builds workspace dashboard URL with conversationId and humanOnly", async () => {
    const { buildHandoffConversationOpenUrl } = await import("./handoff-notify.js");
    expect(
      buildHandoffConversationOpenUrl({
        frontendBaseUrl: "https://app.example.com/",
        workspaceId: "ws-9",
        conversationId: "conv-9",
      }),
    ).toBe("https://app.example.com/ws-9/dashboard?conversationId=conv-9&humanOnly=1");
  });
});

describe("notifyHandoffHuman", () => {
  // Verified notify target → WhatsApp alert is sent with the new searchable body.
  it("sends WhatsApp alert when agent has a verified notify user", async () => {
    mockGetAgent.mockResolvedValue({
      id: "agent-1",
      handoff_notify_user_ids: ["user-notify"],
    });
    mockGetPhone.mockResolvedValue({
      phone: "15551234567",
      status: "verified",
    });

    const { notifyHandoffHuman } = await import("./handoff-notify.js");
    await notifyHandoffHuman({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      reason: "Billing question",
    });

    expect(mockGetPhone).toHaveBeenCalledWith("ws-1", "user-notify", "conn-1");
    expect(mockSendText).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        chatId: "15551234567@c.us",
        text: expect.stringMatching(
          /Senqo handoff: Billing question[\s\S]*Phone: \+19998887777[\s\S]*Line: Main WhatsApp[\s\S]*Workspace: Acme Workspace[\s\S]*conversationId=conv-1/,
        ),
      }),
    );
  });

  // No notify users configured → no send.
  it("no-ops when handoff_notify_user_ids is empty", async () => {
    mockGetAgent.mockResolvedValue({ id: "agent-1", handoff_notify_user_ids: [] });
    const { notifyHandoffHuman } = await import("./handoff-notify.js");
    await notifyHandoffHuman({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
    });
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // Unverified phone → no send for that user.
  it("no-ops when notify phone is not verified", async () => {
    mockGetAgent.mockResolvedValue({
      id: "agent-1",
      handoff_notify_user_ids: ["user-notify"],
    });
    mockGetPhone.mockResolvedValue({ phone: "15551234567", status: "pending" });
    const { notifyHandoffHuman } = await import("./handoff-notify.js");
    await notifyHandoffHuman({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
    });
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // Send failure is swallowed so handoff still succeeds for the caller.
  it("does not throw when WhatsApp send fails", async () => {
    mockGetAgent.mockResolvedValue({
      id: "agent-1",
      handoff_notify_user_ids: ["user-notify"],
    });
    mockGetPhone.mockResolvedValue({ phone: "15551234567", status: "verified" });
    mockSendText.mockRejectedValue(new Error("wa down"));
    const { notifyHandoffHuman } = await import("./handoff-notify.js");
    await expect(
      notifyHandoffHuman({
        workspaceId: "ws-1",
        conversationId: "conv-1",
        agentConfigId: "agent-1",
      }),
    ).resolves.toBeUndefined();
  });

  // scheduleHandoffNotify must never reject so mode toggles can fire-and-forget safely.
  it("scheduleHandoffNotify does not reject when notify would throw", async () => {
    mockGetAgent.mockRejectedValue(new Error("db down"));
    const { scheduleHandoffNotify } = await import("./handoff-notify.js");
    expect(() =>
      scheduleHandoffNotify({
        workspaceId: "ws-1",
        conversationId: "conv-1",
        agentConfigId: "agent-1",
      }),
    ).not.toThrow();
    await vi.waitFor(() => {
      expect(mockGetAgent).toHaveBeenCalled();
    });
  });
});

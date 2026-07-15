import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendAgentWhatsappMessage = vi.fn();

vi.mock("./agent-whatsapp.js", () => ({
  sendAgentWhatsappMessage: (...args: unknown[]) =>
    mockSendAgentWhatsappMessage(...args),
}));

const {
  prepareOutboundMessages,
  sendPreparedOutboundMessages,
} = await import("./agent-outbound-messages.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockSendAgentWhatsappMessage.mockReset();
  mockSendAgentWhatsappMessage.mockResolvedValue({ ok: true, idMessage: "wa-1" });
});

describe("prepareOutboundMessages", () => {
  // Whitespace-only items must not become WhatsApp sends.
  it("drops empty and whitespace-only text items", () => {
    const prepared = prepareOutboundMessages([
      { text: "  " },
      { text: "Hello" },
      { text: "" },
    ]);
    expect(prepared).toEqual([{ text: "Hello", assetFileName: "" }]);
  });

  // Hard cap of three bubbles even if the model returns more.
  it("caps at three messages", () => {
    const prepared = prepareOutboundMessages([
      { text: "one" },
      { text: "two" },
      { text: "three" },
      { text: "four" },
    ]);
    expect(prepared).toHaveLength(3);
    expect(prepared.map((m) => m.text)).toEqual(["one", "two", "three"]);
  });

  // Exact duplicate spam (same text + asset) is skipped within the batch.
  it("skips identical text and assetFileName after normalize", () => {
    const prepared = prepareOutboundMessages([
      { text: "Thanks  for  ordering" },
      { text: "Thanks for ordering" },
    ]);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].text).toBe("Thanks  for  ordering");
  });

  // Same caption with different files are distinct bubbles.
  it("keeps same text with different assetFileName", () => {
    const prepared = prepareOutboundMessages([
      { text: "Menu", assetFileName: "a.pdf" },
      { text: "Menu", assetFileName: "b.pdf" },
    ]);
    expect(prepared).toHaveLength(2);
  });

  // Same file with different captions are distinct bubbles.
  it("keeps same assetFileName with different text", () => {
    const prepared = prepareOutboundMessages([
      { text: "Here is the menu", assetFileName: "menu.pdf" },
      { text: "Updated menu", assetFileName: "menu.pdf" },
    ]);
    expect(prepared).toHaveLength(2);
  });
});

describe("sendPreparedOutboundMessages", () => {
  // Text-only bubble maps to sendAgentWhatsappMessage without asset.
  it("sends a single text-only bubble", async () => {
    const result = await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      messages: [{ text: "Hello" }],
    });
    expect(result.sent).toBe(1);
    expect(mockSendAgentWhatsappMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Hello",
        workspaceId: "ws-1",
        conversationId: "conv-1",
        agentConfigId: "agent-1",
      }),
    );
    expect(mockSendAgentWhatsappMessage.mock.calls[0][0].assetFileName).toBeUndefined();
  });

  // Caption + asset uses both fields on the send service.
  it("sends a single asset with caption", async () => {
    await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      messages: [{ text: "Menu", assetFileName: "menu.pdf" }],
    });
    expect(mockSendAgentWhatsappMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Menu",
        assetFileName: "menu.pdf",
      }),
    );
  });

  // Multiple items are sent in order, including mixed text and assets.
  it("sends text then asset then text in order", async () => {
    mockSendAgentWhatsappMessage
      .mockResolvedValueOnce({ ok: true, idMessage: "1" })
      .mockResolvedValueOnce({ ok: true, idMessage: "2" })
      .mockResolvedValueOnce({ ok: true, idMessage: "3" });

    const result = await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      messages: [
        { text: "Intro" },
        { text: "File", assetFileName: "a.pdf" },
        { text: "Outro" },
      ],
    });

    expect(result.sent).toBe(3);
    expect(mockSendAgentWhatsappMessage).toHaveBeenCalledTimes(3);
    expect(mockSendAgentWhatsappMessage.mock.calls[0][0].message).toBe("Intro");
    expect(mockSendAgentWhatsappMessage.mock.calls[1][0].assetFileName).toBe("a.pdf");
    expect(mockSendAgentWhatsappMessage.mock.calls[2][0].message).toBe("Outro");
  });

  // Two assets in one run each get their own send.
  it("sends two assets as separate calls", async () => {
    await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      messages: [
        { text: "Menu", assetFileName: "menu.pdf" },
        { text: "Prices", assetFileName: "prices.pdf" },
      ],
    });
    expect(mockSendAgentWhatsappMessage).toHaveBeenCalledTimes(2);
    expect(mockSendAgentWhatsappMessage.mock.calls[0][0].assetFileName).toBe("menu.pdf");
    expect(mockSendAgentWhatsappMessage.mock.calls[1][0].assetFileName).toBe("prices.pdf");
  });

  // Dry-run must not hit WhatsApp.
  it("does not send when dryRun is true", async () => {
    const result = await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      messages: [{ text: "Draft" }],
      dryRun: true,
    });
    expect(result.sent).toBe(0);
    expect(result.messages).toEqual([{ text: "Draft", assetFileName: "" }]);
    expect(mockSendAgentWhatsappMessage).not.toHaveBeenCalled();
  });

  // Without agent config there is nothing to resolve for assets/connection.
  it("does not send when agentConfigId is missing", async () => {
    const result = await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "",
      messages: [{ text: "Hello" }],
    });
    expect(result.sent).toBe(0);
    expect(mockSendAgentWhatsappMessage).not.toHaveBeenCalled();
  });

  // First failure stops the batch so later bubbles are not sent out of order.
  it("stops after the first failed send", async () => {
    mockSendAgentWhatsappMessage
      .mockResolvedValueOnce({ ok: false, error: "fail" })
      .mockResolvedValueOnce({ ok: true, idMessage: "2" });

    const result = await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      messages: [{ text: "one" }, { text: "two" }],
    });

    expect(result.sent).toBe(0);
    expect(mockSendAgentWhatsappMessage).toHaveBeenCalledTimes(1);
  });

  // Partial success: first ok, second fails → third not attempted.
  it("stops remaining after a mid-batch failure", async () => {
    mockSendAgentWhatsappMessage
      .mockResolvedValueOnce({ ok: true, idMessage: "1" })
      .mockResolvedValueOnce({ ok: false, error: "fail" })
      .mockResolvedValueOnce({ ok: true, idMessage: "3" });

    const result = await sendPreparedOutboundMessages({
      workspaceId: "ws-1",
      conversationId: "conv-1",
      agentConfigId: "agent-1",
      messages: [{ text: "one" }, { text: "two" }, { text: "three" }],
    });

    expect(result.sent).toBe(1);
    expect(mockSendAgentWhatsappMessage).toHaveBeenCalledTimes(2);
  });
});

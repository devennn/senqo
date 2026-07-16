import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/realtime-bus.js", () => ({ publish: vi.fn() }));

const mockStorageCreateSignedUrl = vi.fn();
vi.mock("../lib/storage.js", () => ({
  storageCreateSignedUrl: (...args: unknown[]) => mockStorageCreateSignedUrl(...args),
  storageDownload: vi.fn(),
}));

const mockFindAgentAssetStorageByFileName = vi.fn();
vi.mock("../repositories/workspace-asset-groups.js", () => ({
  findAgentAssetStorageByFileName: (...args: unknown[]) =>
    mockFindAgentAssetStorageByFileName(...args),
}));

vi.mock("../repositories/conversation-labels.js", () => ({
  listConversationIdsByLabel: vi.fn(),
  listLabelBadgesForConversations: vi.fn(),
}));

vi.mock("../repositories/whatsapp.js", () => ({
  getWhatsappConnectionRowById: vi.fn(),
  isWhatsappConnectionRowSendable: vi.fn(),
  getWorkspaceSendableWhatsappConnectionRow: vi.fn(),
  listWhatsappConnectionSummariesByIds: vi.fn(),
}));

const mockLimit = vi.fn();
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const { listConversationMessagesLatestPage } = await import("./conversations.js");

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageCreateSignedUrl.mockResolvedValue("https://signed.example/img.png");
  mockFindAgentAssetStorageByFileName.mockResolvedValue(null);
});

describe("listConversationMessagesLatestPage media preview", () => {
  // Agent asset messages store agent-assets path + bucket → signed URL uses agent-assets, needed so AI-sent images preview in inbox.
  it("signs agent-assets paths for assistant media", async () => {
    mockLimit.mockResolvedValue([
      {
        id: "m1",
        role: "assistant",
        content: "Here is the product",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        metadata: {
          source: "agent_tool_send_whatsapp",
          media: {
            path: "ws/g/a/product.png",
            storageBucket: "agent-assets",
            fileName: "product.png",
            mimeType: "image/png",
            caption: "Here is the product",
          },
        },
        outgoingSenderType: "ai_agent",
        whatsappSenderChatId: null,
        whatsappSenderName: null,
      },
    ]);

    const result = await listConversationMessagesLatestPage("ws-1", "conv-1", 20);
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith(
      "agent-assets",
      "ws/g/a/product.png",
      60 * 60,
    );
    expect(result.messages[0]?.media?.signedUrl).toBe("https://signed.example/img.png");
  });

  // Legacy agent media without path → lookup by fileName then sign, needed so already-sent AI images still preview.
  it("resolves missing path from agent asset fileName for agent_tool_send_whatsapp", async () => {
    mockFindAgentAssetStorageByFileName.mockResolvedValue({
      storagePath: "ws/g/a/legacy.png",
      mimeType: "image/png",
    });
    mockLimit.mockResolvedValue([
      {
        id: "m2",
        role: "assistant",
        content: "Legacy image",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        metadata: {
          source: "agent_tool_send_whatsapp",
          media: {
            fileName: "legacy.png",
            mimeType: "image/png",
            caption: "Legacy image",
          },
        },
        outgoingSenderType: "ai_agent",
        whatsappSenderChatId: null,
        whatsappSenderName: null,
      },
    ]);

    const result = await listConversationMessagesLatestPage("ws-1", "conv-1", 20);
    expect(mockFindAgentAssetStorageByFileName).toHaveBeenCalledWith("ws-1", "legacy.png");
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith(
      "agent-assets",
      "ws/g/a/legacy.png",
      60 * 60,
    );
    expect(result.messages[0]?.media?.signedUrl).toBe("https://signed.example/img.png");
  });
});

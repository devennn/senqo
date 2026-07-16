import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/realtime-bus.js", () => ({ publish: vi.fn() }));

const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

const mockDb = {
  select: vi.fn(),
  insert: vi.fn().mockReturnValue({ values: mockValues }),
  update: vi.fn().mockReturnValue({ set: mockSet }),
  delete: vi.fn().mockReturnValue({ where: mockWhere }),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const {
  createConnection,
  bindAgentToWhatsappConnection,
  syncAgentWhatsappConnections,
  listConnectionsByAgentConfigId,
  resolveWhatsappConnectionIdForAgentTask,
  updateConnectionMode,
  deleteConnectionByWorkspace,
  findOrCreateConversationByWhatsappChatId,
  getWhatsappConnectionModeForInboundAi,
  createConversationMessage,
} = await vi.importActual("../repositories/whatsapp.js") as typeof import("../repositories/whatsapp.js");

function mockSelectLimitRows(rows: unknown[], options?: { orderBy?: boolean }) {
  const mockLimit = vi.fn().mockResolvedValue(rows);
  const mockWhereSelect = options?.orderBy
    ? vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: mockLimit }),
      })
    : vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
  mockDb.select.mockReturnValueOnce({ from: mockFrom });
}

function mockMessageInsert(insertedRows: Array<{ id: string }>, options?: { withConflict?: boolean }) {
  mockReturning.mockResolvedValue(insertedRows);
  if (options?.withConflict) {
    mockOnConflictDoNothing.mockReturnValue({ returning: mockReturning });
    mockValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
      returning: mockReturning,
    });
  } else {
    mockValues.mockReturnValue({ returning: mockReturning });
  }
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValues.mockReturnValue({ returning: mockReturning });
});

describe("createConnection", () => {
  // Valid display name and token → insert succeeds returning ok:true with connection id, needed to verify WhatsApp connection creation.
  it("inserts with display name", async () => {
    mockReturning.mockResolvedValue([{ id: "conn-1" }]);
    const result = await createConnection({
      workspaceId: "ws-1",
      displayName: "My Device",
      webhookToken: "tok",
    });
    expect(result.ok).toBe(true);
    expect(result.id).toBe("conn-1");
  });

  // Display name exceeds 120 chars → ok:false with display_name_too_long, needed to enforce the length constraint before hitting the DB.
  it("returns error when display name > 120 chars", async () => {
    const longName = "x".repeat(121);
    const result = await createConnection({
      workspaceId: "ws-1",
      displayName: longName,
      webhookToken: "tok",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("display_name_too_long");
  });
});

describe("bindAgentToWhatsappConnection", () => {
  // Valid agent and connection ids → link succeeds with ok:true, needed to verify the agent-to-connection association works.
  it("links agent config to connection", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const result = await bindAgentToWhatsappConnection("ws-1", "agent-1", "conn-1");
    expect(result.ok).toBe(true);
  });
});

describe("syncAgentWhatsappConnections", () => {
  // Syncing A+B attaches both without wiping siblings, needed for multi-connection agents.
  it("syncs multiple connection ids", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const result = await syncAgentWhatsappConnections("ws-1", "agent-1", ["conn-a", "conn-b"]);
    expect(result.ok).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  // Syncing to empty list detaches all, needed so Agent setup can clear attachments.
  it("detaches all when connection ids empty", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const result = await syncAgentWhatsappConnections("ws-1", "agent-1", []);
    expect(result.ok).toBe(true);
    expect(result.message).toBe("Agent detached from WhatsApp connections");
  });
});

describe("listConnectionsByAgentConfigId", () => {
  // Agent with two attached lines → both returned, needed for task UI and validation.
  it("returns all attached connections", async () => {
    const mockOrderBy = vi.fn().mockResolvedValue([
      {
        id: "conn-a",
        workspaceId: "ws-1",
        displayName: "A",
        phoneNumber: "+1",
        mode: "live",
      },
      {
        id: "conn-b",
        workspaceId: "ws-1",
        displayName: "B",
        phoneNumber: "+2",
        mode: "testing",
      },
    ]);
    const mockWhereSelect = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    mockDb.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: mockWhereSelect }) });
    const rows = await listConnectionsByAgentConfigId("ws-1", "agent-1");
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("conn-a");
    expect(rows[1].mode).toBe("testing");
  });
});

describe("resolveWhatsappConnectionIdForAgentTask", () => {
  // Explicit id that is attached → returned, needed so tasks send on the chosen line.
  it("returns explicit attached connection", async () => {
    const mockOrderBy = vi.fn().mockResolvedValue([
      { id: "conn-a", workspaceId: "ws-1", displayName: "A", phoneNumber: null, mode: "live" },
      { id: "conn-b", workspaceId: "ws-1", displayName: "B", phoneNumber: null, mode: "live" },
    ]);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: mockOrderBy }) }),
    });
    const result = await resolveWhatsappConnectionIdForAgentTask("ws-1", "agent-1", "conn-b");
    expect(result).toEqual({ ok: true, connectionId: "conn-b" });
  });

  // No explicit id and exactly one attachment → auto-pick, needed for single-line agents.
  it("auto-picks when agent has exactly one connection", async () => {
    const mockOrderBy = vi.fn().mockResolvedValue([
      { id: "conn-a", workspaceId: "ws-1", displayName: "A", phoneNumber: null, mode: "live" },
    ]);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: mockOrderBy }) }),
    });
    const result = await resolveWhatsappConnectionIdForAgentTask("ws-1", "agent-1", null);
    expect(result).toEqual({ ok: true, connectionId: "conn-a" });
  });

  // No explicit id and multiple attachments → error, needed to prevent sending on a random line.
  it("fails when multiple connections and none specified", async () => {
    const mockOrderBy = vi.fn().mockResolvedValue([
      { id: "conn-a", workspaceId: "ws-1", displayName: "A", phoneNumber: null, mode: "live" },
      { id: "conn-b", workspaceId: "ws-1", displayName: "B", phoneNumber: null, mode: "live" },
    ]);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: mockOrderBy }) }),
    });
    const result = await resolveWhatsappConnectionIdForAgentTask("ws-1", "agent-1", null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("multiple");
    }
  });
});

describe("updateConnectionMode", () => {
  // A valid mode string (testing) is provided → update succeeds with ok:true, needed to confirm mode transitions work.
  it("sets Inactive/Testing/Live mode", async () => {
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const result = await updateConnectionMode("ws-1", "conn-1", "testing");
    expect(result.ok).toBe(true);
  });

  // An unrecognized mode string is passed → ok:false is returned, needed to reject invalid mode values at the repository boundary.
  it("rejects invalid mode", async () => {
    // @ts-expect-error - testing invalid mode input
    const result = await updateConnectionMode("ws-1", "conn-1", "invalid");
    expect(result.ok).toBe(false);
  });
});

describe("getWhatsappConnectionModeForInboundAi", () => {
  // Debounce job passes the line that received the inbound → testing mode is returned even when the thread row still points at an inactive line, needed to fix multi-connection AI gating.
  it("returns preferred connection mode before the conversation row", async () => {
    mockSelectLimitRows([
      {
        id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        mode: "testing",
        status: "authorized",
        agentConfigId: "agent-1",
      },
    ]);

    const mode = await getWhatsappConnectionModeForInboundAi(
      "ws-1",
      "conv-1",
      "agent-1",
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );

    expect(mode).toBe("testing");
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  // Thread row still references an inactive line and no preferred id was queued → inactive is returned, needed to keep inactive lines from running AI when scoping is missing.
  it("returns inactive when conversation is scoped to an inactive line", async () => {
    mockSelectLimitRows([{ whatsappConnectionId: "conn-inactive" }]);
    mockSelectLimitRows([
      {
        id: "conn-inactive",
        mode: "inactive",
        status: "authorized",
        agentConfigId: "agent-1",
      },
    ]);

    const mode = await getWhatsappConnectionModeForInboundAi("ws-1", "conv-1", "agent-1");

    expect(mode).toBe("inactive");
  });

  // Legacy thread has no connection id on the row → latest message metadata supplies the testing line, needed for older conversations before connection scoping was persisted.
  it("falls back to message metadata when conversation connection id is missing", async () => {
    mockSelectLimitRows([{ whatsappConnectionId: null }]);
    mockSelectLimitRows(
      [
        {
          metadata: {
            whatsappConnectionId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
          },
        },
      ],
      { orderBy: true },
    );
    mockSelectLimitRows([
      {
        id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
        mode: "testing",
        status: "authorized",
        agentConfigId: "agent-1",
      },
    ]);

    const mode = await getWhatsappConnectionModeForInboundAi("ws-1", "conv-1", "agent-1");

    expect(mode).toBe("testing");
  });
});

describe("findOrCreateConversationByWhatsappChatId", () => {
  // Same chat id on a different connection is a different thread → insert creates a new conversation, needed so multi-line workspaces keep inbox history and outbound per line.
  it("creates a separate conversation when the same chat id arrives on another line", async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDb.select.mockReturnValue({ from: mockFrom });
    mockReturning.mockResolvedValue([{ id: "conv-b" }]);
    mockValues.mockReturnValue({ returning: mockReturning });

    const conversationId = await findOrCreateConversationByWhatsappChatId(
      "ws-1",
      "conn-b",
      "contact-1",
      "Test User",
      "60123456789@s.whatsapp.net",
    );

    expect(conversationId).toBe("conv-b");
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappConnectionId: "conn-b",
        whatsappChatId: "60123456789@s.whatsapp.net",
      }),
    );
  });

  // Thread already exists for this connection + chat id → reuse without rewriting the line, needed to avoid merging threads across numbers.
  it("reuses the existing conversation for the same connection and chat id", async () => {
    const mockLimit = vi.fn().mockResolvedValue([{ id: "conv-1" }]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDb.select.mockReturnValue({ from: mockFrom });

    const conversationId = await findOrCreateConversationByWhatsappChatId(
      "ws-1",
      "conn-testing",
      "contact-1",
      "Test User",
      "60123456789@s.whatsapp.net",
    );

    expect(conversationId).toBe("conv-1");
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  // Empty connection id → null, needed so WhatsApp-backed threads are never created without a line.
  it("returns null when connection id is empty", async () => {
    const conversationId = await findOrCreateConversationByWhatsappChatId(
      "ws-1",
      "   ",
      "contact-1",
      "Test User",
      "60123456789@s.whatsapp.net",
    );
    expect(conversationId).toBeNull();
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

describe("deleteConnectionByWorkspace", () => {
  // Connection exists under workspace → row is removed and deleted:true is returned, needed to verify successful connection cleanup.
  it("removes connection row", async () => {
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([{ id: "conn-1" }]);
    const result = await deleteConnectionByWorkspace("ws-1", "conn-1");
    expect(result.ok).toBe(true);
    expect(result.deleted).toBe(true);
  });

  // Connection does not exist → ok:true but deleted:false is returned, needed to handle idempotent deletion gracefully.
  it("returns not found when absent", async () => {
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([]);
    const result = await deleteConnectionByWorkspace("ws-1", "no-conn");
    expect(result.ok).toBe(true);
    expect(result.deleted).toBe(false);
  });
});

describe("createConversationMessage", () => {
  // First insert with a Baileys id → ok:true and created:true, needed to verify WA-id rows are persisted and realtime is published.
  it("inserts with waMessageId and returns created true", async () => {
    mockMessageInsert([{ id: "msg-1" }], { withConflict: true });

    const result = await createConversationMessage(
      "ws-1",
      "conv-1",
      "user",
      "hello",
      { source: "whatsapp_webhook", webhookMessageId: "wa-1" },
      "human",
      { waMessageId: "wa-1" },
    );

    expect(result).toEqual({ ok: true, created: true });
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        waMessageId: "wa-1",
        metadata: expect.objectContaining({
          whatsappMessageId: "wa-1",
          webhookMessageId: "wa-1",
        }),
      }),
    );
    expect(mockDb.update).toHaveBeenCalled();
  });

  // Conflict on (workspace_id, wa_message_id) → ok:true and created:false without updating conversation, needed so API-send + outbound_mirror does not double-save.
  it("returns created false when waMessageId already exists", async () => {
    mockMessageInsert([], { withConflict: true });

    const result = await createConversationMessage(
      "ws-1",
      "conv-1",
      "assistant",
      "hello",
      { whatsappMessageId: "wa-dup" },
      "human",
      { waMessageId: "wa-dup" },
    );

    expect(result).toEqual({ ok: true, created: false });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  // Regression: same Baileys id inserted twice in sequence → first created:true, second created:false (API then mirror / retry).
  it("second insert with same waMessageId returns created false", async () => {
    mockMessageInsert([{ id: "msg-first" }], { withConflict: true });
    const first = await createConversationMessage(
      "ws-1",
      "conv-1",
      "assistant",
      "from api",
      { whatsappMessageId: "wa-seq" },
      "human",
      { waMessageId: "wa-seq" },
    );

    mockMessageInsert([], { withConflict: true });
    const second = await createConversationMessage(
      "ws-1",
      "conv-1",
      "assistant",
      "from mirror",
      { webhookMessageId: "wa-seq", whatsappMessageId: "wa-seq" },
      "human",
      { waMessageId: "wa-seq" },
    );

    expect(first).toEqual({ ok: true, created: true });
    expect(second).toEqual({ ok: true, created: false });
  });

  // Metadata has whatsappMessageId and webhookMessageId → column uses whatsappMessageId, needed to match migration COALESCE preference for backfill.
  it("prefers whatsappMessageId over webhookMessageId when resolving from metadata", async () => {
    mockMessageInsert([{ id: "msg-2" }], { withConflict: true });

    await createConversationMessage(
      "ws-1",
      "conv-1",
      "user",
      "hi",
      {
        whatsappMessageId: "from-api",
        webhookMessageId: "from-webhook",
      },
      null,
    );

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ waMessageId: "from-api" }),
    );
  });

  // Thread event with no WA id → plain insert without onConflict, needed so non-WhatsApp rows stay unconstrained.
  it("inserts without conflict clause when waMessageId is absent", async () => {
    mockMessageInsert([{ id: "msg-3" }]);

    const result = await createConversationMessage(
      "ws-1",
      "conv-1",
      "assistant",
      "handoff",
      { source: "thread_event" },
      null,
    );

    expect(result).toEqual({ ok: true, created: true });
    expect(mockOnConflictDoNothing).not.toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ waMessageId: null }),
    );
  });

  // Insert throws → ok:false and created:false, needed to surface persistence failures to webhook/API callers.
  it("returns ok false when insert throws", async () => {
    mockValues.mockReturnValue({
      returning: vi.fn().mockRejectedValue(new Error("db down")),
    });

    const result = await createConversationMessage(
      "ws-1",
      "conv-1",
      "user",
      "hello",
      {},
      null,
    );

    expect(result).toEqual({ ok: false, created: false });
  });
});

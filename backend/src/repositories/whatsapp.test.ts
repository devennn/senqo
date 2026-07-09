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
  // Existing thread was opened on another line → whatsapp_connection_id is updated to the inbound line, needed so multi-connection workspaces gate AI on the active line.
  it("updates whatsapp_connection_id when reusing an existing conversation on a different line", async () => {
    const mockLimit = vi.fn().mockResolvedValue([
      { id: "conv-1", whatsappConnectionId: "conn-inactive" },
    ]);
    const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
    mockDb.select.mockReturnValue({ from: mockFrom });
    mockSet.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const conversationId = await findOrCreateConversationByWhatsappChatId(
      "ws-1",
      "conn-testing",
      "contact-1",
      "Test User",
      "60123456789@s.whatsapp.net",
    );

    expect(conversationId).toBe("conv-1");
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ whatsappConnectionId: "conn-testing" });
  });

  // Thread already belongs to the inbound line → no redundant update is issued, needed to avoid needless writes on every message.
  it("does not update whatsapp_connection_id when the line already matches", async () => {
    const mockLimit = vi.fn().mockResolvedValue([
      { id: "conv-1", whatsappConnectionId: "conn-testing" },
    ]);
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

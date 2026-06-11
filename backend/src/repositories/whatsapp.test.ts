import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/realtime-bus.js", () => ({ publish: vi.fn() }));

const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockSet = vi.fn();
const mockWhere = vi.fn();

const mockDb = {
  select: vi.fn(),
  insert: vi.fn().mockReturnValue({ values: mockValues }),
  update: vi.fn().mockReturnValue({ set: mockSet }),
  delete: vi.fn().mockReturnValue({ where: mockWhere }),
};

vi.mock("../db/index.js", () => ({ db: mockDb }));

const { createConnection, bindAgentToWhatsappConnection, updateConnectionMode, deleteConnectionByWorkspace } =
  await vi.importActual("../repositories/whatsapp.js") as typeof import("../repositories/whatsapp.js");

beforeEach(() => { vi.clearAllMocks(); });

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

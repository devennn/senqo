import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListConnections = vi.fn();
const mockSendText = vi.fn();
const mockUpsertPending = vi.fn();
const mockReplaceVerification = vi.fn();
const mockGetVerification = vi.fn();
const mockMarkVerified = vi.fn();
const mockDeleteVerification = vi.fn();
const mockIncrementAttempts = vi.fn();
const mockGetWorkspace = vi.fn();
const mockFindUser = vi.fn();
const mockHash = vi.fn((code: string) => `hash:${code}`);

vi.mock("../repositories/whatsapp.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/whatsapp.js")>();
  return {
    ...actual,
    listConnections: (...args: unknown[]) => mockListConnections(...args),
  };
});

vi.mock("./whatsapp-client.js", () => ({
  sendTextMessageCompat: (...args: unknown[]) => mockSendText(...args),
}));

vi.mock("../repositories/workspaces.js", () => ({
  getWorkspaceRow: (...args: unknown[]) => mockGetWorkspace(...args),
}));

vi.mock("../repositories/auth-users.js", () => ({
  findUserById: (...args: unknown[]) => mockFindUser(...args),
}));

vi.mock("../repositories/handoff-phones.js", () => ({
  upsertHandoffPhonePending: (...args: unknown[]) => mockUpsertPending(...args),
  replaceHandoffPhoneVerification: (...args: unknown[]) => mockReplaceVerification(...args),
  getHandoffPhoneVerification: (...args: unknown[]) => mockGetVerification(...args),
  markHandoffPhoneVerified: (...args: unknown[]) => mockMarkVerified(...args),
  deleteHandoffPhoneVerification: (...args: unknown[]) => mockDeleteVerification(...args),
  incrementHandoffPhoneVerificationAttempts: (...args: unknown[]) =>
    mockIncrementAttempts(...args),
  clearHandoffPhone: vi.fn(),
  hashHandoffPhoneCode: (code: string) => mockHash(code),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsertPending.mockResolvedValue({ ok: true });
  mockReplaceVerification.mockResolvedValue({ ok: true });
  mockSendText.mockResolvedValue({ messageId: "m1" });
  mockMarkVerified.mockResolvedValue({ ok: true });
  mockGetWorkspace.mockResolvedValue({ name: "Acme Workspace" });
  mockFindUser.mockResolvedValue({ email: "alice@example.com" });
});

describe("handoff-phone-verify", () => {
  // Authorized selected line → OTP is sent from that connection only.
  it("startHandoffPhoneVerification → sends code from the selected connection", async () => {
    mockListConnections.mockResolvedValue([
      { id: "conn-1", status: "authorized" },
      { id: "conn-2", status: "authorized" },
    ]);
    const { startHandoffPhoneVerification } = await import("./handoff-phone-verify.js");
    const result = await startHandoffPhoneVerification({
      workspaceId: "ws-1",
      userId: "user-1",
      phone: "+1 (555) 123-4567",
      whatsappConnectionId: "conn-2",
    });
    expect(result).toEqual({ ok: true });
    expect(mockUpsertPending).toHaveBeenCalledWith("ws-1", "user-1", "conn-2", "15551234567");
    expect(mockSendText).toHaveBeenCalledWith(
      "conn-2",
      expect.objectContaining({
        chatId: "15551234567@c.us",
        text: expect.stringMatching(
          /confirmation code is \d{6}\n\nWorkspace: Acme Workspace\nAccount: alice@example\.com/,
        ),
      }),
    );
  });

  // Selected line not authorized → registration fails.
  it("startHandoffPhoneVerification → fails when selected connection is not authorized", async () => {
    mockListConnections.mockResolvedValue([{ id: "conn-1", status: "pending_qr" }]);
    const { startHandoffPhoneVerification } = await import("./handoff-phone-verify.js");
    const result = await startHandoffPhoneVerification({
      workspaceId: "ws-1",
      userId: "user-1",
      phone: "15551234567",
      whatsappConnectionId: "conn-1",
    });
    expect(result).toEqual({ ok: false, message: "no_whatsapp_connection" });
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // Handoff phone must not match any WhatsApp connection line in the workspace.
  it("startHandoffPhoneVerification → fails when phone matches a connected number", async () => {
    mockListConnections.mockResolvedValue([
      { id: "conn-1", status: "authorized", phone_number: "+1 (555) 123-4567" },
    ]);
    const { startHandoffPhoneVerification } = await import("./handoff-phone-verify.js");
    const result = await startHandoffPhoneVerification({
      workspaceId: "ws-1",
      userId: "user-1",
      phone: "15551234567",
      whatsappConnectionId: "conn-1",
    });
    expect(result).toEqual({ ok: false, message: "phone_is_connection" });
    expect(mockUpsertPending).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });

  // Wrong code increments attempts and returns invalid_code.
  it("confirmHandoffPhoneVerification → rejects wrong code", async () => {
    mockGetVerification.mockResolvedValue({
      phone: "15551234567",
      codeHash: "hash:123456",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    const { confirmHandoffPhoneVerification } = await import("./handoff-phone-verify.js");
    const result = await confirmHandoffPhoneVerification({
      workspaceId: "ws-1",
      userId: "user-1",
      whatsappConnectionId: "conn-1",
      code: "000000",
    });
    expect(result).toEqual({ ok: false, message: "invalid_code" });
    expect(mockIncrementAttempts).toHaveBeenCalledWith("ws-1", "user-1", "conn-1");
  });

  // Matching code marks verified for that connection.
  it("confirmHandoffPhoneVerification → verifies on matching code", async () => {
    mockGetVerification.mockResolvedValue({
      phone: "15551234567",
      codeHash: "hash:123456",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    const { confirmHandoffPhoneVerification } = await import("./handoff-phone-verify.js");
    const result = await confirmHandoffPhoneVerification({
      workspaceId: "ws-1",
      userId: "user-1",
      whatsappConnectionId: "conn-1",
      code: "123456",
    });
    expect(result).toEqual({ ok: true });
    expect(mockMarkVerified).toHaveBeenCalledWith("ws-1", "user-1", "conn-1", "15551234567");
    expect(mockDeleteVerification).toHaveBeenCalledWith("ws-1", "user-1", "conn-1");
  });

  // Expired code is rejected.
  it("confirmHandoffPhoneVerification → rejects expired code", async () => {
    mockGetVerification.mockResolvedValue({
      phone: "15551234567",
      codeHash: "hash:123456",
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
    });
    const { confirmHandoffPhoneVerification } = await import("./handoff-phone-verify.js");
    const result = await confirmHandoffPhoneVerification({
      workspaceId: "ws-1",
      userId: "user-1",
      whatsappConnectionId: "conn-1",
      code: "123456",
    });
    expect(result).toEqual({ ok: false, message: "code_expired" });
  });
});

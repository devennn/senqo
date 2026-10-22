import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDeleteBefore = vi.fn();
const mockEnv = { whatsappPayloadDumpRetentionDays: 30 };

vi.mock("../lib/env.js", () => ({ env: mockEnv }));
vi.mock("../repositories/whatsapp.js", () => ({
  deleteWebhookPayloadDumpsBefore: mockDeleteBefore,
}));

const { runWebhookDumpRetention } = await import("./webhook-dump-retention.js");

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  mockEnv.whatsappPayloadDumpRetentionDays = 30;
  mockDeleteBefore.mockResolvedValue({ ok: true, deleted: 3 });
});

describe("runWebhookDumpRetention", () => {
  // Normal run: dumps older than the configured window are deleted, with a cutoff ~N days back so
  // the retained data actually matches the configured window.
  it("deletes dumps older than the configured retention window", async () => {
    const before = Date.now();

    await runWebhookDumpRetention();

    const cutoff = mockDeleteBefore.mock.calls[0]?.[0] as Date;
    expect(cutoff).toBeInstanceOf(Date);
    expect(Math.abs(cutoff.getTime() - (before - 30 * DAY_MS))).toBeLessThan(5_000);
  });

  // A window of 0 disables cleanup on purpose (self-hosters may want to keep payloads forever) —
  // the repository must not be touched at all.
  it("skips cleanup when retention is disabled", async () => {
    mockEnv.whatsappPayloadDumpRetentionDays = 0;

    await runWebhookDumpRetention();

    expect(mockDeleteBefore).not.toHaveBeenCalled();
  });

  // Error path: a failing repository result must be swallowed (logged only) so the scheduled
  // worker does not throw, fail its job, and retry-storm.
  it("does not throw when the repository reports failure", async () => {
    mockDeleteBefore.mockResolvedValue({ ok: false, deleted: 0 });

    await expect(runWebhookDumpRetention()).resolves.toBeUndefined();
  });
});

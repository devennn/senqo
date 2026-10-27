import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateSignedUrl = vi.hoisted(() => vi.fn());
const mockParseSignedUrlKey = vi.hoisted(() => vi.fn());

vi.mock("../lib/storage.js", () => ({
  storageCreateSignedUrl: mockCreateSignedUrl,
  storageParseSignedUrlKey: mockParseSignedUrlKey,
}));

const { resolveHistoryMediaForModel } = await import("./history-media.js");

const MEDIA_REF_PART = {
  type: "media_ref",
  media: { bucket: "whatsapp-media", path: "ws-1/chat-1/msg-1/a.bin" },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveHistoryMediaForModel", () => {
  // Persisted references have no URL; replay must mint one before the model call.
  it("signs media_ref parts into fresh image_url parts", async () => {
    mockCreateSignedUrl.mockResolvedValue("https://storage.example/fresh?X-Amz-Signature=new");

    const resolved = await resolveHistoryMediaForModel([
      { type: "text", text: "look at this" },
      MEDIA_REF_PART,
    ]);

    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "whatsapp-media",
      "ws-1/chat-1/msg-1/a.bin",
      3600,
    );
    expect(resolved).toEqual([
      { type: "text", text: "look at this" },
      {
        type: "image_url",
        image_url: { url: "https://storage.example/fresh?X-Amz-Signature=new" },
      },
    ]);
  });

  // Rows written before the fix stored signed URLs; replay re-signs them so an
  // expired signature can never fail the run, preserving the part's detail flag.
  it("re-signs legacy signed image_url parts and keeps their detail", async () => {
    const staleUrl =
      "https://proj.storage.supabase.co/storage/v1/s3/app-bucket/whatsapp-media/ws-1/a.bin?X-Amz-Signature=stale";
    mockParseSignedUrlKey.mockReturnValue({
      bucketName: "whatsapp-media",
      key: "ws-1/a.bin",
    });
    mockCreateSignedUrl.mockResolvedValue("https://storage.example/renewed");

    const resolved = await resolveHistoryMediaForModel([
      { type: "image_url", image_url: { url: staleUrl, detail: "auto" } },
    ]);

    expect(mockParseSignedUrlKey).toHaveBeenCalledWith(staleUrl);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "whatsapp-media",
      "ws-1/a.bin",
      3600,
    );
    expect(resolved).toEqual([
      {
        type: "image_url",
        image_url: { url: "https://storage.example/renewed", detail: "auto" },
      },
    ]);
  });

  // Thumbnails are self-contained data URLs and must not be re-signed or dropped.
  it("passes data URL image parts through untouched", async () => {
    const part = {
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,AAAA" },
    };

    const resolved = await resolveHistoryMediaForModel([part]);

    expect(resolved).toEqual([part]);
    expect(mockParseSignedUrlKey).not.toHaveBeenCalled();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  // URLs that are not this deployment's storage cannot be renewed; replay keeps
  // them as-is so behavior for external links is unchanged.
  it("keeps non-storage image URLs as-is", async () => {
    mockParseSignedUrlKey.mockReturnValue(null);
    const part = {
      type: "image_url",
      image_url: { url: "https://cdn.example.com/public/photo.jpg" },
    };

    const resolved = await resolveHistoryMediaForModel([part]);

    expect(resolved).toEqual([part]);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  // The legacy URL was recognized but re-signing failed (e.g. storage error):
  // drop it so the rest of the run can proceed.
  it("drops a legacy signed URL when re-signing fails", async () => {
    mockParseSignedUrlKey.mockReturnValue({
      bucketName: "whatsapp-media",
      key: "ws-1/a.bin",
    });
    mockCreateSignedUrl.mockResolvedValue(null);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resolved = await resolveHistoryMediaForModel([
      { type: "text", text: "kept" },
      {
        type: "image_url",
        image_url: { url: "https://proj.storage.supabase.co/storage/v1/s3/x/a.bin?X-Amz-Signature=s" },
      },
    ]);

    expect(resolved).toEqual([{ type: "text", text: "kept" }]);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("could not re-sign legacy signed URL"),
    );
    consoleWarn.mockRestore();
  });

  // Unknown buckets are not ours to sign; the part is dropped rather than guessed.
  it("drops media_ref parts with an unknown bucket", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resolved = await resolveHistoryMediaForModel([
      { type: "media_ref", media: { bucket: "other-bucket", path: "ws-1/a.bin" } },
    ]);

    expect(resolved).toEqual([]);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining("could not sign stored media"),
    );
    consoleWarn.mockRestore();
  });

  // A malformed reference (missing path) must not reach the signer.
  it("drops media_ref parts with a missing path", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resolved = await resolveHistoryMediaForModel([
      { type: "media_ref", media: { bucket: "whatsapp-media" } },
    ]);

    expect(resolved).toEqual([]);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  // A storage outage while signing one reference must not take down the run.
  it("drops a media_ref part when signing fails and keeps the rest", async () => {
    mockCreateSignedUrl.mockResolvedValue(null);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resolved = await resolveHistoryMediaForModel([
      MEDIA_REF_PART,
      { type: "text", text: "after" },
    ]);

    expect(resolved).toEqual([{ type: "text", text: "after" }]);
    consoleWarn.mockRestore();
  });

  // Non-array payloads are plain text turns; return them unchanged.
  it("returns non-array content unchanged", async () => {
    expect(await resolveHistoryMediaForModel("hello")).toBe("hello");
    expect(await resolveHistoryMediaForModel(null)).toBeNull();
  });

  // Non-media parts (tool calls, provider options) must survive resolution intact.
  it("keeps non-media parts untouched", async () => {
    const toolPart = {
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "get_weather",
      input: { city: "KL" },
    };

    expect(await resolveHistoryMediaForModel([toolPart])).toEqual([toolPart]);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});

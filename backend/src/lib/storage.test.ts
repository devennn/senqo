import { afterEach, describe, expect, it, vi } from "vitest";
import { storageParseSignedUrlKey } from "./storage.js";

const SUPABASE_ENDPOINT = "https://proj.storage.supabase.co/storage/v1/s3";
const R2_ENDPOINT = "https://acct.r2.cloudflarestorage.com";

function supabaseSignedUrl(path: string): string {
  return `${SUPABASE_ENDPOINT}${path}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storageParseSignedUrlKey", () => {
  // Legacy transcripts stored signed URLs; replay re-signs them from the recovered
  // namespace + key, so the round-trip for a path-prefixed endpoint must be exact.
  it("recovers the storage namespace and key from a path-style signed URL", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(
        supabaseSignedUrl("/app-bucket/whatsapp-media/ws-1/chat-1/msg-1/file.bin"),
      ),
    ).toEqual({
      bucketName: "whatsapp-media",
      key: "ws-1/chat-1/msg-1/file.bin",
    });
  });

  // R2-style endpoints have no path prefix; the bucket segment must still resolve.
  it("recovers the reference when the endpoint has no path prefix", () => {
    vi.stubEnv("S3_ENDPOINT", R2_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "senqo-wa");

    expect(
      storageParseSignedUrlKey(
        `${R2_ENDPOINT}/senqo-wa/agent-assets/doc.txt?X-Amz-Signature=abc`,
      ),
    ).toEqual({ bucketName: "agent-assets", key: "doc.txt" });
  });

  // Percent-encoded path segments must decode back to the exact stored key.
  it("decodes percent-encoded key segments", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(
        supabaseSignedUrl("/app-bucket/whatsapp-media/ws-1/chat%20one/photo%20a.bin"),
      ),
    ).toEqual({
      bucketName: "whatsapp-media",
      key: "ws-1/chat one/photo a.bin",
    });
  });

  // Anything that is not a signed URL for this endpoint cannot be re-signed;
  // returning null lets replay drop it instead of fetching a dead URL.
  it("returns null for a data URL", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey("data:image/jpeg;base64,AAAA"),
    ).toBeNull();
  });

  // Unsigned URLs may be external links; without a signature there is nothing to renew.
  it("returns null when the URL has no X-Amz-Signature", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(`${SUPABASE_ENDPOINT}/app-bucket/whatsapp-media/file.bin`),
    ).toBeNull();
  });

  // A signed URL for another host must never be treated as this deployment's storage.
  it("returns null for a different host", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(
        `https://evil.example.com/storage/v1/s3/app-bucket/whatsapp-media/file.bin?X-Amz-Signature=abc`,
      ),
    ).toBeNull();
  });

  // Same host but outside the endpoint's path prefix (e.g. another service) is not ours.
  it("returns null when the path does not start with the endpoint prefix", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(
        `https://proj.storage.supabase.co/storage/v1/object/app-bucket/whatsapp-media/file.bin?X-Amz-Signature=abc`,
      ),
    ).toBeNull();
  });

  // The first path segment must be this deployment's configured S3 bucket.
  it("returns null when the first segment is not the configured bucket", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(
        supabaseSignedUrl("/other-bucket/whatsapp-media/file.bin"),
      ),
    ).toBeNull();
  });

  // A URL with no object key has nothing to re-sign.
  it("returns null when the key is missing", () => {
    vi.stubEnv("S3_ENDPOINT", SUPABASE_ENDPOINT);
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(supabaseSignedUrl("/app-bucket/whatsapp-media")),
    ).toBeNull();
  });

  // Without an endpoint the client cannot verify the host, so parsing fails closed.
  it("returns null when no S3 endpoint is configured", () => {
    vi.stubEnv("S3_ENDPOINT", "");
    vi.stubEnv("S3_BUCKET", "app-bucket");

    expect(
      storageParseSignedUrlKey(
        `https://app-bucket.example.com/app-bucket/whatsapp-media/file.bin?X-Amz-Signature=abc`,
      ),
    ).toBeNull();
  });
});

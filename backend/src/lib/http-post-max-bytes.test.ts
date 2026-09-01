import { describe, expect, it } from "vitest";
import { HTTP_POST_MAX_BYTES, isHttpPostTooLarge } from "./http-post-max-bytes.js";

const MB = 1024 * 1024;

describe("isHttpPostTooLarge", () => {
  // A 12 MB PDF is within the 20 MB per-file product cap; the old 10 MB gate 413'd it.
  it("allows a 12 MB Content-Length", () => {
    expect(isHttpPostTooLarge(String(12 * MB))).toBe(false);
  });

  // Missing Content-Length cannot be gated here; route-level validators still apply.
  it("allows a missing Content-Length header", () => {
    expect(isHttpPostTooLarge(undefined)).toBe(false);
  });

  // Bodies larger than the derived import/asset ceiling must be rejected before parsing.
  it("rejects Content-Length over the derived max", () => {
    expect(isHttpPostTooLarge(String(HTTP_POST_MAX_BYTES + 1))).toBe(true);
  });
});

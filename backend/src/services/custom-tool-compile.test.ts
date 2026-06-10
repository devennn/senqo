import { describe, expect, it } from "vitest";
import { compileCustomToolSource } from "./custom-tool-compile.js";

const unionInputSource = `export async function execute(
  input: { mode: "alpha" | "beta", count?: number },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  return { ok: true, mode: input.mode };
}`;

describe("compileCustomToolSource → accepts string literal union input types", () => {
  it("returns metadata with enum schema for union properties", async () => {
    const result = await compileCustomToolSource(unionInputSource);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.inputSchema).toEqual({
      type: "object",
      properties: {
        mode: { type: "string", enum: ["alpha", "beta"], minLength: 1 },
        count: { type: "number" },
      },
      required: ["mode"],
      additionalProperties: false,
    });
  });
});

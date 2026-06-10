import { describe, expect, it } from "vitest";
import { inferCustomToolInputSchema } from "./infer-custom-tool-input-schema.js";

const executeOnly = `export async function execute(
  input: { location: string },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  return { ok: true, location: input.location };
}`;

describe("inferCustomToolInputSchema", () => {
  it("infers required string properties from execute input type", () => {
    const result = inferCustomToolInputSchema(executeOnly);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inputSchema).toEqual({
      type: "object",
      properties: { location: { type: "string", minLength: 1 } },
      required: ["location"],
      additionalProperties: false,
    });
  });

  it("ignores legacy exports and still infers schema", () => {
    const legacy = `export const description = "old";
export const requiredEnv = [] as const;
export const inputSchema = { type: "object", properties: {}, required: [] } as const;
${executeOnly}`;
    const result = inferCustomToolInputSchema(legacy);
    expect(result.ok).toBe(true);
  });

  it("returns error when execute export is missing", () => {
    const result = inferCustomToolInputSchema("export function run() {}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("execute");
  });

  it("rejects mixed unions that are not all string literals", () => {
    const source = `export async function execute(
  input: { mode: "alpha" | number },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  return { ok: true };
}`;
    const result = inferCustomToolInputSchema(source);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("mode");
  });

  it("infers string literal unions as enum properties", () => {
    const source = `export async function execute(
  input: { mode: "alpha" | "beta", count?: number },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  return { ok: true, mode: input.mode, count: input.count ?? 1 };
}`;
    const result = inferCustomToolInputSchema(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inputSchema).toEqual({
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

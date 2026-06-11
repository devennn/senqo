import { describe, expect, it } from "vitest";
import { inferCustomToolInputSchema } from "./infer-custom-tool-input-schema.js";

const executeOnly = `export async function execute(
  input: { location: string },
  ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  return { ok: true, location: input.location };
}`;

describe("inferCustomToolInputSchema", () => {
  // Parses the `execute` function's input type to produce a JSON Schema with required string properties.
  // Expected: returns ok=true with an object schema containing "location" as a required string.
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

  // Legacy exports (description, requiredEnv, inputSchema) should not break inference.
  // Expected: still returns ok=true, ignoring the old constants.
  it("ignores legacy exports and still infers schema", () => {
    const legacy = `export const description = "old";
export const requiredEnv = [] as const;
export const inputSchema = { type: "object", properties: {}, required: [] } as const;
${executeOnly}`;
    const result = inferCustomToolInputSchema(legacy);
    expect(result.ok).toBe(true);
  });

  // If no `execute` export exists, inference must fail with a relevant error.
  // Expected: returns ok=false with an error message containing "execute".
  it("returns error when execute export is missing", () => {
    const result = inferCustomToolInputSchema("export function run() {}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("execute");
  });

  // Mixed unions (e.g. string literal | number) are not supported and must be rejected.
  // Expected: returns ok=false with an error message mentioning "mode".
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

  // String literal unions should be inferred as JSON Schema enum properties.
  // Expected: returns ok=true with mode as a string enum and count as an optional number.
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

import { describe, expect, it } from "vitest";
import { jsonSchemaToZod } from "./json-schema-to-zod.js";

describe("jsonSchemaToZod → validates string enum properties", () => {
  const schema = jsonSchemaToZod({
    type: "object",
    properties: {
      mode: { type: "string", enum: ["alpha", "beta"] },
      count: { type: "number" },
    },
    required: ["mode"],
  });

  // Values listed in the enum must parse successfully.
  // Expected: schema.parse accepts both "alpha" and "beta" (with optional count).
  it("accepts allowed enum values", () => {
    expect(schema.parse({ mode: "alpha" })).toEqual({ mode: "alpha" });
    expect(schema.parse({ mode: "beta", count: 10 })).toEqual({
      mode: "beta",
      count: 10,
    });
  });

  // Values not in the enum must throw a Zod validation error.
  // Expected: schema.parse throws when mode is "gamma".
  it("rejects values outside the enum", () => {
    expect(() => schema.parse({ mode: "gamma" })).toThrow();
  });
});

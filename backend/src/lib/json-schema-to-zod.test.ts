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

  it("accepts allowed enum values", () => {
    expect(schema.parse({ mode: "alpha" })).toEqual({ mode: "alpha" });
    expect(schema.parse({ mode: "beta", count: 10 })).toEqual({
      mode: "beta",
      count: 10,
    });
  });

  it("rejects values outside the enum", () => {
    expect(() => schema.parse({ mode: "gamma" })).toThrow();
  });
});

import { z } from "zod";

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  minLength?: number;
  enum?: string[];
  additionalProperties?: boolean;
};

function propertySchema(schema: JsonSchema): z.ZodTypeAny {
  if (schema.type === "number" || schema.type === "integer") {
    return z.number();
  }
  if (schema.type === "boolean") {
    return z.boolean();
  }
  if (schema.type === "string" && schema.enum && schema.enum.length > 0) {
    const [first, ...rest] = schema.enum;
    return z.enum([first, ...rest] as [string, ...string[]]);
  }
  let stringSchema = z.string();
  if (schema.minLength !== undefined) {
    stringSchema = stringSchema.min(schema.minLength);
  }
  return stringSchema;
}

export function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const typed = schema as JsonSchema;
  if (typed.type !== "object" || !typed.properties) {
    return z.record(z.string(), z.unknown());
  }
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(typed.required ?? []);
  for (const [key, propSchema] of Object.entries(typed.properties)) {
    const base = propertySchema(propSchema);
    shape[key] = required.has(key) ? base : base.optional();
  }
  return z.object(shape);
}

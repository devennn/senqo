import { describe, expect, it } from "vitest";
import { DEFAULT_TOOL_TEST_INPUT, normalizeToolTestInput } from "@/lib/custom-tool-test-input";

describe("normalizeToolTestInput → uses stored JSON or default", () => {
  it("returns default when stored value is empty", () => {
    expect(normalizeToolTestInput("")).toBe(DEFAULT_TOOL_TEST_INPUT);
    expect(normalizeToolTestInput(undefined)).toBe(DEFAULT_TOOL_TEST_INPUT);
  });

  it("returns trimmed stored value when present", () => {
    expect(normalizeToolTestInput('{ "status": "new" }')).toBe('{ "status": "new" }');
  });
});

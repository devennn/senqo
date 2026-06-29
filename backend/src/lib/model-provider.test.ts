import { describe, expect, it } from "vitest";
import { parseModelProvider } from "./model-provider.js";

describe("parseModelProvider", () => {
  // Valid openrouter values should normalize to the openrouter provider id.
  // Expected: returns "openrouter" for typical env casing and whitespace.
  it('returns "openrouter" for normalized openrouter values', () => {
    expect(parseModelProvider("openrouter")).toBe("openrouter");
    expect(parseModelProvider(" OpenRouter ")).toBe("openrouter");
  });

  // Valid openai values should normalize to the openai provider id.
  // Expected: returns "openai" for typical env casing and whitespace.
  it('returns "openai" for normalized openai values', () => {
    expect(parseModelProvider("openai")).toBe("openai");
    expect(parseModelProvider(" OpenAI ")).toBe("openai");
  });

  // Unknown provider strings should fail fast with allowed values listed.
  // Expected: throws with MODEL_PROVIDER guidance for unsupported values.
  it("throws for unsupported provider values", () => {
    expect(() => parseModelProvider("anthropic")).toThrow(
      'MODEL_PROVIDER must be one of: openrouter, openai (got "anthropic")',
    );
  });
});

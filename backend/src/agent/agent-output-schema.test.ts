import { describe, it, expect } from "vitest";
import { agentOutputObjectSchema, agentOutputSchema } from "./agent-output-schema.js";

function baseFields(overrides: Record<string, unknown> = {}) {
  return {
    messages: [{ text: "Hi", assetFileName: "" }],
    reasoning_for_operators: "Greeting",
    knowledge_used: false,
    sources: [],
    handoff_enabled: false,
    ...overrides,
  };
}

describe("agentOutputSchema", () => {
  // Normal reply turn with WhatsApp bubbles and no handoff.
  it("accepts handoff_enabled false with one to three messages", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [
        { text: "Hi", assetFileName: "" },
        { text: "We can help", assetFileName: "" },
        { text: "Anytime", assetFileName: "" },
      ],
      reasoning_for_operators: "Greeting",
      knowledge_used: false,
      sources: [],
      handoff_enabled: false,
    });
    expect(parsed.success).toBe(true);
  });

  // Preferred handoff shape: flag true, no customer bubbles, knowledge ref for topic.
  it("accepts handoff_enabled true with empty messages", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [],
      reasoning_for_operators: "Billing handoff",
      knowledge_used: true,
      sources: [{ kind: "handoff", group: "Escalations", label: "Billing" }],
      handoff_enabled: true,
    });
    expect(parsed.success).toBe(true);
  });

  // Optional courtesy bubble while handing off without citing knowledge.
  it("accepts handoff_enabled true with a single courtesy message", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "A teammate will help you shortly.", assetFileName: "" }],
      reasoning_for_operators: "Courtesy after handoff",
      knowledge_used: false,
      sources: [],
      handoff_enabled: true,
    });
    expect(parsed.success).toBe(true);
  });

  // Asset caption item is valid; empty assetFileName means text-only (Azure requires the key).
  it("accepts assetFileName string including empty for text-only", () => {
    const withAsset = agentOutputSchema.safeParse(
      baseFields({
        messages: [{ text: "Menu", assetFileName: "menu.pdf" }],
        reasoning_for_operators: "",
      }),
    );
    expect(withAsset.success).toBe(true);

    const textOnly = agentOutputSchema.safeParse(
      baseFields({ reasoning_for_operators: "" }),
    );
    expect(textOnly.success).toBe(true);
  });

  // Missing assetFileName fails Azure-compatible schema (key must always be present).
  it("rejects message items missing assetFileName", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({ messages: [{ text: "Hi" }], reasoning_for_operators: "" }),
    );
    expect(parsed.success).toBe(false);
  });

  // handoff_enabled is required on every structured result.
  it("rejects missing handoff_enabled", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "Hi", assetFileName: "" }],
      reasoning_for_operators: "",
      knowledge_used: false,
      sources: [],
    });
    expect(parsed.success).toBe(false);
  });

  // knowledge_used is required on every structured result.
  it("rejects missing knowledge_used", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "Hi", assetFileName: "" }],
      reasoning_for_operators: "",
      sources: [],
      handoff_enabled: false,
    });
    expect(parsed.success).toBe(false);
  });

  // Azure structured output requires sources on every result.
  it("rejects missing sources", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "Hi", assetFileName: "" }],
      reasoning_for_operators: "",
      knowledge_used: false,
      handoff_enabled: false,
    });
    expect(parsed.success).toBe(false);
  });

  // knowledge_used true without refs must fail so greetings stay explicit.
  it("rejects knowledge_used true with empty sources", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({
        knowledge_used: true,
        sources: [],
        reasoning_for_operators: "Used refund policy",
      }),
    );
    expect(parsed.success).toBe(false);
  });

  // knowledge_used false must not invent refs.
  it("rejects knowledge_used false with non-empty sources", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({
        knowledge_used: false,
        sources: [{ kind: "context", group: "Policies", label: "Refund policy" }],
      }),
    );
    expect(parsed.success).toBe(false);
  });

  // Reference chips deep-link to an expanded entry only when the ref carries its parent
  // group, so `group` is a required field rather than an optional hint.
  it("rejects a source missing group", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({
        knowledge_used: true,
        sources: [{ kind: "context", label: "Refund policy" }],
      }),
    );
    expect(parsed.success).toBe(false);
  });

  // Skills have no `####` heading in Available Information, so an empty group must stay valid.
  it("accepts a skill source with an empty group", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({
        knowledge_used: true,
        sources: [{ kind: "skill", group: "", label: "Booking flow" }],
      }),
    );
    expect(parsed.success).toBe(true);
  });

  // Non-boolean handoff flag must fail validation.
  it("rejects non-boolean handoff_enabled", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({
        messages: [],
        reasoning_for_operators: "",
        handoff_enabled: "yes",
      }),
    );
    expect(parsed.success).toBe(false);
  });

  // Hard max of three outbound bubbles.
  it("rejects more than three messages", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({
        messages: [
          { text: "1", assetFileName: "" },
          { text: "2", assetFileName: "" },
          { text: "3", assetFileName: "" },
          { text: "4", assetFileName: "" },
        ],
        reasoning_for_operators: "",
      }),
    );
    expect(parsed.success).toBe(false);
  });

  // Empty text is not a valid bubble.
  it("rejects message items without text", () => {
    const parsed = agentOutputSchema.safeParse(
      baseFields({
        messages: [{ text: "", assetFileName: "a.pdf" }],
        reasoning_for_operators: "",
      }),
    );
    expect(parsed.success).toBe(false);
  });

  // Model guidance must be present on every field via .describe.
  it("includes describes on messages, nested fields, reasoning, sources, knowledge_used, and handoff_enabled", () => {
    expect(agentOutputObjectSchema.shape.messages.description).toMatch(/WhatsApp bubbles/i);
    expect(agentOutputObjectSchema.shape.reasoning_for_operators.description).toMatch(
      /Dashboard-only/i,
    );
    expect(agentOutputObjectSchema.shape.knowledge_used.description).toMatch(/knowledge/i);
    expect(agentOutputObjectSchema.shape.sources.description).toMatch(/knowledge_used/i);
    expect(agentOutputObjectSchema.shape.handoff_enabled.description).toMatch(/handoff_to_human/i);
    const messageShape = agentOutputObjectSchema.shape.messages.element.shape;
    expect(messageShape.text.description).toMatch(/bubble/i);
    expect(messageShape.assetFileName.description).toMatch(/empty string/i);
  });
});

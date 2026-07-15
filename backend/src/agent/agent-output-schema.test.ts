import { describe, it, expect } from "vitest";
import { agentOutputSchema } from "./agent-output-schema.js";

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
      handoff_enabled: false,
    });
    expect(parsed.success).toBe(true);
  });

  // Preferred handoff shape: flag true, no customer bubbles.
  it("accepts handoff_enabled true with empty messages", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [],
      reasoning_for_operators: "Billing handoff",
      handoff_enabled: true,
    });
    expect(parsed.success).toBe(true);
  });

  // Optional courtesy bubble while handing off.
  it("accepts handoff_enabled true with a single courtesy message", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "A teammate will help you shortly.", assetFileName: "" }],
      reasoning_for_operators: "Courtesy after handoff",
      handoff_enabled: true,
    });
    expect(parsed.success).toBe(true);
  });

  // Asset caption item is valid; empty assetFileName means text-only (Azure requires the key).
  it("accepts assetFileName string including empty for text-only", () => {
    const withAsset = agentOutputSchema.safeParse({
      messages: [{ text: "Menu", assetFileName: "menu.pdf" }],
      reasoning_for_operators: "",
      handoff_enabled: false,
    });
    expect(withAsset.success).toBe(true);

    const textOnly = agentOutputSchema.safeParse({
      messages: [{ text: "Hi", assetFileName: "" }],
      reasoning_for_operators: "",
      handoff_enabled: false,
    });
    expect(textOnly.success).toBe(true);
  });

  // Missing assetFileName fails Azure-compatible schema (key must always be present).
  it("rejects message items missing assetFileName", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "Hi" }],
      reasoning_for_operators: "",
      handoff_enabled: false,
    });
    expect(parsed.success).toBe(false);
  });

  // handoff_enabled is required on every structured result.
  it("rejects missing handoff_enabled", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "Hi" }],
      reasoning_for_operators: "",
    });
    expect(parsed.success).toBe(false);
  });

  // Non-boolean handoff flag must fail validation.
  it("rejects non-boolean handoff_enabled", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [],
      reasoning_for_operators: "",
      handoff_enabled: "yes",
    });
    expect(parsed.success).toBe(false);
  });

  // Hard max of three outbound bubbles.
  it("rejects more than three messages", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [
        { text: "1", assetFileName: "" },
        { text: "2", assetFileName: "" },
        { text: "3", assetFileName: "" },
        { text: "4", assetFileName: "" },
      ],
      reasoning_for_operators: "",
      handoff_enabled: false,
    });
    expect(parsed.success).toBe(false);
  });

  // Empty text is not a valid bubble.
  it("rejects message items without text", () => {
    const parsed = agentOutputSchema.safeParse({
      messages: [{ text: "", assetFileName: "a.pdf" }],
      reasoning_for_operators: "",
      handoff_enabled: false,
    });
    expect(parsed.success).toBe(false);
  });

  // Model guidance must be present on every field via .describe.
  it("includes describes on messages, nested fields, reasoning, and handoff_enabled", () => {
    expect(agentOutputSchema.shape.messages.description).toMatch(/WhatsApp bubbles/i);
    expect(agentOutputSchema.shape.reasoning_for_operators.description).toMatch(
      /Dashboard-only/i,
    );
    expect(agentOutputSchema.shape.handoff_enabled.description).toMatch(/handoff_to_human/i);
    const messageShape = agentOutputSchema.shape.messages.element.shape;
    expect(messageShape.text.description).toMatch(/bubble/i);
    expect(messageShape.assetFileName.description).toMatch(/empty string/i);
  });
});

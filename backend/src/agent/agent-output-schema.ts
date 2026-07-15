import { z } from "zod";

export const agentOutboundMessageSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe("One WhatsApp bubble to send to the customer."),
  assetFileName: z
    .string()
    .describe(
      "Exact filename from the agent Assets list when attaching that file. Use an empty string for text-only bubbles.",
    ),
});

export const agentOutputSchema = z.object({
  messages: z
    .array(agentOutboundMessageSchema)
    .max(3)
    .describe(
      "Customer WhatsApp bubbles for this turn. Prefer one; at most three distinct messages; never repeat the same text. Empty if no outbound reply.",
    ),
  reasoning_for_operators: z
    .string()
    .describe(
      "Dashboard-only: why this run's reply fits the customer and what grounded it. Never customer-facing. Empty string when nothing to explain.",
    ),
  handoff_enabled: z
    .boolean()
    .describe(
      "True when this turn handed the conversation to a human (you called handoff_to_human). False otherwise.",
    ),
});

export type AgentOutboundMessage = z.infer<typeof agentOutboundMessageSchema>;
export type AgentStructuredOutput = z.infer<typeof agentOutputSchema>;

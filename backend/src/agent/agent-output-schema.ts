import { z } from "zod";

export const agentKnowledgeKindSchema = z.enum([
  "context",
  "template",
  "skill",
  "handoff",
]);

export const agentKnowledgeRefSchema = z.object({
  kind: agentKnowledgeKindSchema.describe(
    "Where the fact came from: workspace context, a response template, a loaded skill, or a handoff topic.",
  ),
  group: z
    .string()
    .describe(
      "Exact `####` group heading this item sits under in Available Information. Empty string for skills, which have no group.",
    ),
  label: z
    .string()
    .min(1)
    .describe(
      "Exact name of the one item inside that group you used: a context entry title, a template question intent, a handoff topic, or a skill name. Never the group heading itself.",
    ),
});

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

/** Plain object fields (Azure JSON Schema). Cross-field rules live on `agentOutputSchema`. */
export const agentOutputObjectSchema = z.object({
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
  knowledge_used: z
    .boolean()
    .describe(
      "True when this reply used workspace context, a response template, a loaded skill, or a handoff topic. False for greetings and small talk with no knowledge refs.",
    ),
  sources: z
    .array(agentKnowledgeRefSchema)
    .describe(
      "Dashboard-only knowledge refs actually used, each naming its `group` plus the specific item `label` inside it. Required non-empty when knowledge_used is true; must be [] when knowledge_used is false. Never customer-facing. Use exact names from Available Information or loaded skills.",
    ),
  handoff_enabled: z
    .boolean()
    .describe(
      "True when this turn handed the conversation to a human (you called handoff_to_human). False otherwise.",
    ),
});

export const agentOutputSchema = agentOutputObjectSchema.superRefine((value, ctx) => {
  if (value.knowledge_used) {
    if (value.sources.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sources"],
        message: "sources must have at least one item when knowledge_used is true",
      });
    }
    return;
  }
  if (value.sources.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sources"],
      message: "sources must be empty when knowledge_used is false",
    });
  }
});

export type AgentOutboundMessage = z.infer<typeof agentOutboundMessageSchema>;
export type AgentKnowledgeRef = z.infer<typeof agentKnowledgeRefSchema>;
export type AgentStructuredOutput = z.infer<typeof agentOutputObjectSchema>;

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, Output, type ModelMessage, stepCountIs } from "ai";
import { z } from "zod";
import type { RunAgentInput, RunAgentResult } from "../types/agent.js";
import {
  formatAgentPrepareStepBlock,
  formatAgentStepFinishBlock,
  inferStepAction,
  previewMessage,
  summarizeText,
} from "../agent/logging.js";
import {
  asStorableAgentMessageContent,
  extractGeneratedModelMessages,
  pruneOrphanedToolCalls,
  toModelMessageFromRow,
} from "../agent/messages.js";
import { resolveSessionId } from "../agent/session.js";
import { buildAgentInstructions } from "../agent/skills-catalog.js";
import { getAgentTools } from "../agent/tools/index.js";
import { normalizeStoredContentForModelMessage } from "../lib/agent-multimodal-normalize.js";
import { BUILTIN_AGENT_TOOL_KEYS } from "../lib/builtin-agent-tool-keys.js";
import { env } from "../lib/env.js";
import type { StoredUserImageUrlPart, StoredUserTextPart } from "../types/agent-multimodal.js";
import {
  insertAgentMessages,
  listAgentMessages,
} from "../repositories/agent-messages.js";
import { getAgentConfigById, markAgentConfigFirstUsed } from "../repositories/agent.js";
import { touchAgentSession } from "../repositories/agent-sessions.js";
import { mergeAiReasoningOntoAgentRunMessages } from "../repositories/whatsapp.js";

const openrouter = createOpenRouter({
  apiKey: env.openRouterApiKey,
});

const logScope = "AgentRuntime";
const agentOutputSchema = z.object({
  reply: z.string().describe("Final user-facing reply or summary for the agent run."),
  num_whatsapp_send: z
    .number()
    .int()
    .min(0)
    .describe("Number of WhatsApp messages the agent actually sent with the send_whatsapp_message tool."),
  reasoning_for_operators: z.string().describe(
    "Dashboard-only: why this run's reply fits the customer and what grounded it (thread, templates, context, skills, behavior, tools). Never customer-facing. Use an empty string when there is nothing to explain.",
  ),
});

const DEFAULT_AGENT_TOOL_KEYS = BUILTIN_AGENT_TOOL_KEYS;

function isMissingToolResultError(messageText: string): boolean {
  return /Tool result(s)? (is|are) missing for tool call(s)?/i.test(messageText);
}

function isSuccessfulWhatsappToolOutput(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (value as { ok?: unknown }).ok === true;
}

function countSuccessfulWhatsappSends(result: {
  steps?: Array<{ toolResults?: Array<{ toolName?: string; output?: unknown }> }>;
}): number {
  return (result.steps ?? []).reduce((count, step) => {
    const sentInStep = (step.toolResults ?? []).filter(
      (toolResult) =>
        toolResult.toolName === "send_whatsapp_message" &&
        isSuccessfulWhatsappToolOutput(toolResult.output),
    ).length;
    return count + sentInStep;
  }, 0);
}

export async function runAgentSession(
  input: RunAgentInput,
): Promise<RunAgentResult | null> {
  const isDryRun = Boolean(input.dryRun);
  const skipInference = Boolean(input.skipInference);
  const sessionId = await resolveSessionId(input.workspaceId, isDryRun, input.sessionId);
  if (!sessionId) {
    return null;
  }

  const agentRunId = !isDryRun ? crypto.randomUUID() : undefined;

  let historyMessages: ModelMessage[] = [];
  if (!isDryRun) {
    const historicalRows = await listAgentMessages(input.workspaceId, sessionId);
    const rawHistory = historicalRows.map((row) =>
      toModelMessageFromRow({
        role: row.role,
        content: row.content,
      }),
    );
    historyMessages = pruneOrphanedToolCalls(rawHistory);
    if (historyMessages.length < rawHistory.length) {
      console.warn(
        `[${logScope}] Pruned ${rawHistory.length - historyMessages.length} orphaned tool-call message(s) from history sessionId=${sessionId}`
      );
    } else {
      // Temporary diagnostic: log assistant message content shapes so we can
      // tell whether tool calls are stored in the format our pruner expects.
      const assistantShapes = rawHistory
        .filter((m) => m.role === "assistant")
        .map((m) => {
          if (typeof m.content === "string") return "string";
          if (!Array.isArray(m.content)) return typeof m.content;
          return m.content
            .map((p) => (p as { type?: string }).type ?? "unknown")
            .join("+");
        });
      console.info(
        `[${logScope}] History shape sessionId=${sessionId} rows=${rawHistory.length} assistantContent=[${assistantShapes.join(", ")}]`
      );
    }
  }

  const inboundMessageContent = input.messageTimestamp
    ? `Incoming message timestamp: ${input.messageTimestamp}\n\n${input.message}`
    : input.message;
  const mediaParts = input.userMediaParts ?? [];
  const textPart: StoredUserTextPart = { type: "text", text: inboundMessageContent };
  const userContentForDb: Array<StoredUserTextPart | StoredUserImageUrlPart> =
    mediaParts.length > 0 ? [textPart, ...mediaParts] : [textPart];

  const userMessageForModel = {
    role: "user" as const,
    content: normalizeStoredContentForModelMessage({
      role: "user",
      content: userContentForDb,
    }),
  } as ModelMessage;

  if (!isDryRun) {
    const userSaved = await insertAgentMessages([
      {
        workspaceId: input.workspaceId,
        sessionId,
        role: "user",
        content: asStorableAgentMessageContent("user", userContentForDb),
      },
    ]);

    if (!userSaved) {
      return null;
    }

    if (input.agentConfigId && !skipInference) {
      await markAgentConfigFirstUsed(input.workspaceId, input.agentConfigId);
    }
  }

  if (skipInference) {
    if (!isDryRun) {
      await touchAgentSession(input.workspaceId, sessionId);
      const reason = input.skipInferenceReason?.trim() || "inference skipped by policy";
      console.info(
        `[${logScope}] Inbound saved to agent session but not processed: sessionId=${sessionId} reason=${reason}`
      );
    }
    return {
      sessionId,
      reply: "",
      num_whatsapp_send: 0,
      modelMessages: [],
      reasoningForOperators: "",
    };
  }

  const instructions = await buildAgentInstructions(
    input.workspaceId,
    input.agentConfigId,
    isDryRun,
  );
  const config = input.agentConfigId
    ? await getAgentConfigById(input.workspaceId, input.agentConfigId)
    : null;
  const enabledToolKeys = Array.from(
    new Set([
      ...DEFAULT_AGENT_TOOL_KEYS,
      ...(Array.isArray(config?.tools) ? config.tools : []),
    ]),
  );
  const tools = await getAgentTools(
    {
      workspaceId: input.workspaceId,
      sessionId,
      agentConfigId: input.agentConfigId,
      ...(agentRunId ? { agentRunId } : {}),
    },
    enabledToolKeys,
  );
  const activeTools = Object.keys(tools).filter((toolName) => {
    if (toolName === "send_whatsapp_message") {
      return !isDryRun;
    }
    return true;
  });

  console.info(
    `[${logScope}/tools] active=${activeTools.length > 0 ? activeTools.join(",") : "none"}`,
  );

  const agent = new ToolLoopAgent({
    model: openrouter.chat("openai/gpt-4.1"),
    instructions,
    tools,
    activeTools,
    output: Output.object({
      schema: agentOutputSchema,
      name: "agent_run_result",
      description:
        "Return the final agent run result. If this run needs an outbound WhatsApp reply, call send_whatsapp_message before returning and set num_whatsapp_send to the count of sent messages. Include reasoning_for_operators for workspace operators (never paste into send_whatsapp_message).",
    }),
    stopWhen: stepCountIs(20),
    prepareStep: ({ stepNumber, messages }) => {
      const lastMessage = messages[messages.length - 1] as ModelMessage | undefined;
      const action = inferStepAction(lastMessage);
      console.info(
        formatAgentPrepareStepBlock(logScope, {
          stepNumber,
          action,
          totalMessages: messages.length,
          lastPreview: previewMessage(lastMessage),
        }),
      );
      return {};
    },
    onStepFinish: (event) => {
      const textPreview = summarizeText(event.text);
      const toolCalls = Array.isArray(event.toolCalls) ? event.toolCalls : [];
      const toolResults = Array.isArray(event.toolResults) ? event.toolResults : [];
      const toolNames =
        toolCalls.length > 0 ? toolCalls.map((call) => call.toolName).join(", ") : "(none)";
      const stepAction =
        toolCalls.length > 0 ? "calling tools" : textPreview ? "drafting response" : "reasoning";

      console.info(
        formatAgentStepFinishBlock(logScope, {
          stepNumber: event.stepNumber,
          stepAction,
          finishReason: event.finishReason,
          toolNames,
          textPreview,
          toolCallsCount: toolCalls.length,
          toolResultsCount: toolResults.length,
          toolCalls: toolCalls.map((call) => ({
            toolName: call.toolName,
            toolCallId: call.toolCallId,
            args: call.input,
          })),
          toolResults: toolResults.map((result) => ({
            toolName: result.toolName,
            toolCallId: result.toolCallId,
            output: result.output,
          })),
        }),
      );
    },
  });

  const primaryInputMessages = [...historyMessages, userMessageForModel];
  let result: Awaited<ReturnType<typeof agent.generate>>;
  try {
    result = await agent.generate({
      messages: primaryInputMessages,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (isMissingToolResultError(messageText)) {
      console.error(
        `[${logScope}] Failed query: tool-call mismatch, retrying once without tools detail=${messageText}`
      );
      const fallbackAgent = new ToolLoopAgent({
        model: openrouter.chat("openai/gpt-4.1"),
        instructions,
        tools: {},
        activeTools: [],
        output: Output.object({
          schema: agentOutputSchema,
          name: "agent_run_result",
          description:
            "Return the final agent run result without calling tools. Set num_whatsapp_send to 0 and include reasoning_for_operators.",
        }),
        stopWhen: stepCountIs(20),
      });
      const cleanHistory = pruneOrphanedToolCalls(historyMessages);
      result = await fallbackAgent.generate({
        messages: [...cleanHistory, userMessageForModel],
      });
    } else {
      throw error;
    }
  }

  const generated = extractGeneratedModelMessages(result);
  const generatedToPersist = generated;

  if (!isDryRun) {
    const persisted = await insertAgentMessages(
      generatedToPersist.map((message) => ({
        workspaceId: input.workspaceId,
        sessionId,
        role: message.role,
        content: asStorableAgentMessageContent(message.role, message.content),
      })),
    );

    if (!persisted) {
      return null;
    }

    await touchAgentSession(input.workspaceId, sessionId);
  }

  const structuredOutput = result.output;
  const numWhatsappSend = countSuccessfulWhatsappSends(result);
  const reply = structuredOutput.reply;
  const reasoningForOperators = (structuredOutput.reasoning_for_operators ?? "").trim();

  if (!isDryRun && agentRunId && reasoningForOperators) {
    const merged = await mergeAiReasoningOntoAgentRunMessages({
      workspaceId: input.workspaceId,
      conversationId: sessionId,
      agentRunId,
      aiReasoning: reasoningForOperators,
    });
    if (!merged.ok) {
      console.error(`[${logScope}] Failed to persist operator reasoning metadata for conversationId=${sessionId}`);
    }
  }

  return {
    sessionId,
    reply,
    num_whatsapp_send: numWhatsappSend,
    modelMessages: generatedToPersist,
    reasoningForOperators,
  };
}

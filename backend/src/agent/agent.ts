import { ToolLoopAgent, Output, type ModelMessage, stepCountIs } from "ai";
import type { RunAgentInput, RunAgentResult } from "../types/agent.js";
import {
  formatAgentPrepareStepBlock,
  formatAgentStepFinishBlock,
  formatAgentStructuredOutputBlock,
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
import type {
  StoredUserImageUrlPart,
  StoredUserTextPart,
} from "../types/agent-multimodal.js";
import {
  insertAgentMessages,
  listAgentMessages,
} from "../repositories/agent-messages.js";
import {
  getAgentConfigById,
  markAgentConfigFirstUsed,
} from "../repositories/agent.js";
import { touchAgentSession } from "../repositories/agent-sessions.js";
import { mergeAiReasoningOntoAgentRunMessages } from "../repositories/whatsapp.js";
import { prepareOutboundMessages, sendPreparedOutboundMessages } from "../services/agent-outbound-messages.js";
import {
  AGENT_RUN_LOG_KIND_LLM_OUTPUT,
  AGENT_RUN_LOG_KIND_WHATSAPP_SENT,
  AGENT_RUN_LOG_SOURCE,
  isAgentRunLogProviderOptions,
} from "../lib/agent-run-log.js";
import { agentOutputSchema } from "./agent-output-schema.js";
import { getChatLLM } from "./llm.js";

const logScope = "AgentRuntime";

const DEFAULT_AGENT_TOOL_KEYS = BUILTIN_AGENT_TOOL_KEYS;

function isMissingToolResultError(messageText: string): boolean {
  return /Tool result(s)? (is|are) missing for tool call(s)?/i.test(
    messageText,
  );
}

export async function runAgentSession(
  input: RunAgentInput,
): Promise<RunAgentResult | null> {
  const isDryRun = Boolean(input.dryRun);
  const skipInference = Boolean(input.skipInference);
  const sessionId = await resolveSessionId(
    input.workspaceId,
    isDryRun,
    input.sessionId,
  );
  if (!sessionId) {
    return null;
  }

  const agentRunId = !isDryRun ? crypto.randomUUID() : undefined;

  let historyMessages: ModelMessage[] = [];
  if (!isDryRun) {
    const historicalRows = (await listAgentMessages(
      input.workspaceId,
      sessionId,
    )).filter((row) => !isAgentRunLogProviderOptions(row.provider_options));
    const rawHistory = historicalRows.map((row) =>
      toModelMessageFromRow({
        role: row.role,
        content: row.content,
      }),
    );
    historyMessages = pruneOrphanedToolCalls(rawHistory);
    if (historyMessages.length < rawHistory.length) {
      console.warn(
        `[${logScope}] Pruned ${rawHistory.length - historyMessages.length} orphaned tool-call message(s) from history sessionId=${sessionId}`,
      );
    } else {
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
        `[${logScope}] History shape sessionId=${sessionId} rows=${rawHistory.length} assistantContent=[${assistantShapes.join(", ")}]`,
      );
    }
  }

  const inboundMessageContent = input.messageTimestamp
    ? `Incoming message timestamp: ${input.messageTimestamp}\n\n${input.message}`
    : input.message;
  const mediaParts = input.userMediaParts ?? [];
  const textPart: StoredUserTextPart = {
    type: "text",
    text: inboundMessageContent,
  };
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
      const reason =
        input.skipInferenceReason?.trim() || "inference skipped by policy";
      console.info(
        `[${logScope}] Inbound saved to agent session but not processed: sessionId=${sessionId} reason=${reason}`,
      );
    }
    return {
      sessionId,
      messages: [],
      handoff_enabled: false,
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
  const activeTools = Object.keys(tools);

  console.info(
    `[${logScope}/tools] active=${activeTools.length > 0 ? activeTools.join(",") : "none"}`,
  );

  const agent = new ToolLoopAgent({
    model: getChatLLM(),
    instructions,
    tools,
    activeTools,
    output: Output.object({
      schema: agentOutputSchema,
      name: "agent_run_result",
      description:
        "Return the final agent run result. Put customer WhatsApp bubbles in messages (0–3). Set handoff_enabled when you called handoff_to_human. Include reasoning_for_operators for workspace operators (never paste into messages).",
    }),
    stopWhen: stepCountIs(20),
    prepareStep: ({ stepNumber, messages }) => {
      const lastMessage = messages[messages.length - 1] as
        | ModelMessage
        | undefined;
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
      const toolResults = Array.isArray(event.toolResults)
        ? event.toolResults
        : [];
      const toolNames =
        toolCalls.length > 0
          ? toolCalls.map((call) => call.toolName).join(", ")
          : "(none)";
      const stepAction =
        toolCalls.length > 0
          ? "calling tools"
          : textPreview
            ? "drafting response"
            : "reasoning";

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
        `[${logScope}] Failed query: tool-call mismatch, retrying once without tools detail=${messageText}`,
      );
      const fallbackAgent = new ToolLoopAgent({
        model: getChatLLM(),
        instructions,
        tools: {},
        activeTools: [],
        output: Output.object({
          schema: agentOutputSchema,
          name: "agent_run_result",
          description:
            "Return the final agent run result without calling tools. Prefer empty messages, handoff_enabled false, and include reasoning_for_operators.",
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
  const rawMessages = Array.isArray(structuredOutput?.messages)
    ? structuredOutput.messages
    : [];
  const handoffEnabled = Boolean(structuredOutput?.handoff_enabled);
  const reasoningForOperators = (
    structuredOutput?.reasoning_for_operators ?? ""
  ).trim();

  let outboundMessages = prepareOutboundMessages(rawMessages);
  let outboundSent = 0;
  let deliveries: Array<{
    text: string;
    assetFileName: string;
    idMessage: string;
  }> = [];
  if (input.agentConfigId) {
    const sent = await sendPreparedOutboundMessages({
      workspaceId: input.workspaceId,
      conversationId: sessionId,
      agentConfigId: input.agentConfigId,
      messages: rawMessages,
      dryRun: isDryRun,
      ...(agentRunId ? { agentRunId } : {}),
    });
    outboundMessages = sent.messages;
    outboundSent = sent.sent;
    deliveries = sent.deliveries;
  }

  console.info(
    formatAgentStructuredOutputBlock(logScope, {
      sessionId,
      dryRun: isDryRun,
      structuredOutput,
      outboundPrepared: outboundMessages,
      outboundSent,
    }),
  );

  if (!isDryRun) {
    const logRows = [
      {
        workspaceId: input.workspaceId,
        sessionId,
        role: "assistant" as const,
        content: {
          type: AGENT_RUN_LOG_KIND_LLM_OUTPUT,
          messages: structuredOutput?.messages ?? [],
          reasoning_for_operators: reasoningForOperators,
          handoff_enabled: handoffEnabled,
        },
        providerOptions: {
          source: AGENT_RUN_LOG_SOURCE,
          kind: AGENT_RUN_LOG_KIND_LLM_OUTPUT,
          ...(agentRunId ? { agent_run_id: agentRunId } : {}),
        },
      },
      {
        workspaceId: input.workspaceId,
        sessionId,
        role: "assistant" as const,
        content: {
          type: AGENT_RUN_LOG_KIND_WHATSAPP_SENT,
          sent: outboundSent,
          dryRun: isDryRun,
          bubbles: deliveries.map((d) => ({
            text: d.text,
            assetFileName: d.assetFileName,
            idMessage: d.idMessage,
          })),
        },
        providerOptions: {
          source: AGENT_RUN_LOG_SOURCE,
          kind: AGENT_RUN_LOG_KIND_WHATSAPP_SENT,
          ...(agentRunId ? { agent_run_id: agentRunId } : {}),
        },
      },
    ];
    const logsSaved = await insertAgentMessages(logRows);
    if (!logsSaved) {
      console.error(
        `[${logScope}] Failed query: could not persist agent run logs conversationId=${sessionId}`,
      );
    }
  }

  if (!isDryRun && agentRunId && reasoningForOperators) {
    const merged = await mergeAiReasoningOntoAgentRunMessages({
      workspaceId: input.workspaceId,
      conversationId: sessionId,
      agentRunId,
      aiReasoning: reasoningForOperators,
    });
    if (!merged.ok) {
      console.error(
        `[${logScope}] Failed to persist operator reasoning metadata for conversationId=${sessionId}`,
      );
    }
  }

  return {
    sessionId,
    messages: outboundMessages,
    handoff_enabled: handoffEnabled,
  };
}

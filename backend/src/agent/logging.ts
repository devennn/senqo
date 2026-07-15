import type { ModelMessage } from "ai";
import type {
  AgentStepFinishToolCallLog,
  AgentStepFinishToolResultLog,
} from "../types/agent.js";

const maxLogLength = 280;

function truncateText(value: string, max = maxLogLength): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}

export function previewMessage(message: ModelMessage | undefined): string {
  if (!message) return "none";

  if (typeof message.content === "string") {
    return `${message.role}:${truncateText(message.content)}`;
  }

  if (Array.isArray(message.content)) {
    return `${message.role}:parts(${message.content.length})`;
  }

  return `${message.role}:complex`;
}

export function inferStepAction(lastMessage: ModelMessage | undefined): string {
  if (!lastMessage) return "start reasoning";
  if (lastMessage.role === "user") return "analyze user request";
  if (lastMessage.role === "tool") return "process tool result";
  if (lastMessage.role === "assistant") return "continue reasoning";
  return "follow system guidance";
}

export function summarizeText(text: string | undefined): string {
  return typeof text === "string" ? truncateText(text) : "";
}

const agentLogRuleHeavy = "═".repeat(62);
const agentLogRuleLight = "─".repeat(62);

function kvLine(label: string, value: string): string {
  const key = label.endsWith(":") ? label : `${label}:`;
  return `  ${key.padEnd(22)} ${value}`;
}

export function formatAgentPrepareStepBlock(
  scope: string,
  input: {
    stepNumber: number;
    action: string;
    totalMessages: number;
    lastPreview: string;
  },
): string {
  return [
    `[${scope}]`,
    agentLogRuleHeavy,
    "  prepareStep",
    agentLogRuleLight,
    kvLine("step", String(input.stepNumber)),
    kvLine("doing", input.action),
    kvLine("total messages", String(input.totalMessages)),
    kvLine("last message", input.lastPreview),
    agentLogRuleHeavy,
    "",
  ].join("\n");
}

export function formatAgentStepFinishBlock(
  scope: string,
  input: {
    stepNumber: number;
    stepAction: string;
    finishReason: string;
    toolNames: string;
    textPreview: string;
    toolCallsCount: number;
    toolResultsCount: number;
    toolCalls: AgentStepFinishToolCallLog[];
    toolResults: AgentStepFinishToolResultLog[];
  },
): string {
  const lines: string[] = [
    `[${scope}]`,
    agentLogRuleHeavy,
    "  step finished",
    agentLogRuleLight,
    kvLine("step", String(input.stepNumber)),
    kvLine("action", input.stepAction),
    kvLine("finish reason", input.finishReason),
    kvLine("tools", input.toolNames),
    kvLine("text", input.textPreview || "(none)"),
    kvLine("tool calls", String(input.toolCallsCount)),
    kvLine("tool results", String(input.toolResultsCount)),
  ];

  if (input.toolCalls.length > 0) {
    lines.push(agentLogRuleLight, "  Tool calls");
    lines.push(
      prettyJsonForLog(
        input.toolCalls.map((call) => ({
          toolName: call.toolName,
          toolCallId: call.toolCallId,
          args: call.args,
        })),
        { maxLength: 8000 },
      ),
    );
  }

  if (input.toolResults.length > 0) {
    lines.push(agentLogRuleLight, "  Tool results");
    lines.push(
      prettyJsonForLog(
        input.toolResults.map((result) => ({
          toolName: result.toolName,
          toolCallId: result.toolCallId,
          output: result.output,
        })),
        { maxLength: 8000 },
      ),
    );
  }

  lines.push(agentLogRuleHeavy, "");
  return lines.join("\n");
}

export function formatAgentStructuredOutputBlock(
  scope: string,
  input: {
    sessionId: string;
    dryRun: boolean;
    structuredOutput: unknown;
    outboundPrepared: unknown;
    outboundSent: number;
  },
): string {
  return [
    `[${scope}]`,
    agentLogRuleHeavy,
    "  agent_run_result (LLM structured output)",
    agentLogRuleLight,
    kvLine("session", input.sessionId),
    kvLine("dry run", String(input.dryRun)),
    kvLine("whatsapp sent", String(input.outboundSent)),
    agentLogRuleLight,
    "  Full LLM output",
    prettyJsonForLog(input.structuredOutput, { maxLength: 20_000 }),
    agentLogRuleLight,
    "  Outbound after prepare/dedupe",
    prettyJsonForLog(input.outboundPrepared, { maxLength: 8_000 }),
    agentLogRuleHeavy,
    "",
  ].join("\n");
}

export function prettyJsonForLog(
  value: unknown,
  options?: { maxLength?: number; linePrefix?: string },
): string {
  const maxLength = options?.maxLength ?? 6000;
  const linePrefix = options?.linePrefix ?? "    ";
  let raw: string;
  try {
    raw = JSON.stringify(value, null, 2);
  } catch {
    return `${linePrefix}[unserializable]`;
  }

  if (raw.length > maxLength) {
    raw = `${raw.slice(0, maxLength)}\n… (truncated, ${raw.length} chars total)`;
  }

  return raw
    .split("\n")
    .map((line) => `${linePrefix}${line}`)
    .join("\n");
}

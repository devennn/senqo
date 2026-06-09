import type { ModelMessage } from "ai";
import { normalizeStoredContentForModelMessage } from "../lib/agent-multimodal-normalize.js";
import type { AgentMessageRole } from "../types/repositories.js";

function toModelMessageArray(value: unknown): ModelMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages: ModelMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (
      (role === "system" ||
        role === "user" ||
        role === "assistant" ||
        role === "tool") &&
      content !== undefined
    ) {
      messages.push({ role, content } as ModelMessage);
    }
  }

  return messages;
}

/**
 * Aggregates response messages from every step. Each step's `response.messages`
 * holds the messages produced during that step (assistant turn plus any tool
 * messages for tools that have execute functions). Aggregating across steps
 * captures intermediate tool call/result pairs that `result.response.messages`
 * (last step only) would drop.
 */
export function extractGeneratedModelMessages(result: unknown): ModelMessage[] {
  const typed = result as {
    response?: { messages?: unknown };
    steps?: Array<{ response?: { messages?: unknown } }>;
  };

  if (Array.isArray(typed.steps) && typed.steps.length > 0) {
    const fromSteps: ModelMessage[] = [];
    for (const step of typed.steps) {
      fromSteps.push(...toModelMessageArray(step.response?.messages));
    }
    if (fromSteps.length > 0) return fromSteps;
  }

  return toModelMessageArray(typed.response?.messages);
}

/**
 * Walks the history sequentially and drops any assistant message whose tool
 * calls are not all resolved by tool-result messages before the next
 * user/system message. Mirrors the SDK's own validation order so the surviving
 * history will never trigger MissingToolResultsError.
 */
export function pruneOrphanedToolCalls(messages: ModelMessage[]): ModelMessage[] {
  const toRemove = new Set<number>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    if (!Array.isArray(msg.content)) continue;

    const callIds: string[] = [];
    for (const part of msg.content) {
      const p = part as { type?: string; toolCallId?: string };
      if (p.type === "tool-call" && typeof p.toolCallId === "string") {
        callIds.push(p.toolCallId);
      }
    }
    if (callIds.length === 0) continue;

    const unresolved = new Set(callIds);
    for (let j = i + 1; j < messages.length && unresolved.size > 0; j++) {
      const next = messages[j];
      if (next.role === "user" || next.role === "system") break;
      if (next.role !== "tool") continue;
      if (!Array.isArray(next.content)) continue;
      for (const part of next.content) {
        const p = part as { type?: string; toolCallId?: string };
        if (p.type === "tool-result" && p.toolCallId) {
          unresolved.delete(p.toolCallId);
        }
      }
    }

    if (unresolved.size > 0) toRemove.add(i);
  }

  if (toRemove.size === 0) return messages;
  return messages.filter((_, i) => !toRemove.has(i));
}

/**
 * Persist `user` / `assistant` turns as multimodal JSON: plain strings become
 * `[{ "type": "text", "text": "..." }]`. Other roles and non-string content unchanged.
 */
export function asStorableAgentMessageContent(
  role: AgentMessageRole,
  content: unknown,
): unknown {
  if ((role === "user" || role === "assistant") && typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  return content;
}

export function toModelMessageFromRow(row: {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
}): ModelMessage {
  return {
    role: row.role,
    content: normalizeStoredContentForModelMessage({
      role: row.role,
      content: row.content,
    }) as never,
  } as ModelMessage;
}

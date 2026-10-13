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
 * Returns the messages produced by an agent run so they can be stored.
 *
 * AI SDK v6 builds each step's `response.messages` as a cumulative snapshot of
 * every message generated so far in the run, and the top-level
 * `response.messages` carries the final snapshot. The top-level array is
 * therefore already the full generated set. Concatenating per-step snapshots
 * (v5 semantics) persists each earlier step once per later step, duplicating
 * tool call/result pairs that providers reject on the next turn ("each
 * tool_use must have a single result").
 */
export function extractGeneratedModelMessages(result: unknown): ModelMessage[] {
  const typed = result as {
    response?: { messages?: unknown };
    steps?: Array<{ response?: { messages?: unknown } }>;
  };

  const fromResponse = toModelMessageArray(typed.response?.messages);
  if (fromResponse.length > 0) return fromResponse;

  const lastStep = Array.isArray(typed.steps)
    ? typed.steps[typed.steps.length - 1]
    : undefined;
  return toModelMessageArray(lastStep?.response?.messages);
}

/**
 * Walks the history sequentially and drops any assistant message whose tool
 * calls are not all resolved by tool-result messages before the next
 * user/system message. Mirrors the SDK's own validation order so the surviving
 * history will never trigger MissingToolResultsError.
 */
function pruneOrphanedToolCalls(messages: ModelMessage[]): ModelMessage[] {
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
 * Removes tool history that providers reject:
 *
 * - duplicate `tool-call` / `tool-result` parts for the same `toolCallId`
 *   (older runtime code persisted cumulative AI SDK step snapshots, so a run
 *   with tools wrote its earlier steps once per later step), and
 * - `tool-result` parts whose `tool-call` was pruned as an orphan.
 *
 * The first occurrence of every tool call/result is kept, then orphaned tool
 * calls are pruned. Existing poisoned sessions recover on their next run
 * because history is sanitized again on every load.
 */
export function sanitizeToolCallHistory(
  messages: ModelMessage[],
): ModelMessage[] {
  const seenCallIds = new Set<string>();
  const seenResultIds = new Set<string>();

  const deduped: ModelMessage[] = [];
  for (const message of messages) {
    if (!Array.isArray(message.content)) {
      deduped.push(message);
      continue;
    }

    const parts = message.content.filter((part) => {
      const p = part as { type?: string; toolCallId?: string };
      const toolCallId =
        typeof p.toolCallId === "string" ? p.toolCallId : undefined;
      if (toolCallId && p.type === "tool-call") {
        if (seenCallIds.has(toolCallId)) return false;
        seenCallIds.add(toolCallId);
        return true;
      }
      if (toolCallId && p.type === "tool-result") {
        if (seenResultIds.has(toolCallId)) return false;
        seenResultIds.add(toolCallId);
        return true;
      }
      return true;
    });

    if (parts.length === 0) continue;
    deduped.push({ ...message, content: parts } as ModelMessage);
  }

  const pruned = pruneOrphanedToolCalls(deduped);

  const survivingCallIds = new Set<string>();
  for (const message of pruned) {
    if (message.role !== "assistant" || !Array.isArray(message.content)) {
      continue;
    }
    for (const part of message.content) {
      const p = part as { type?: string; toolCallId?: string };
      if (p.type === "tool-call" && typeof p.toolCallId === "string") {
        survivingCallIds.add(p.toolCallId);
      }
    }
  }

  const cleaned: ModelMessage[] = [];
  for (const message of pruned) {
    if (message.role !== "tool" || !Array.isArray(message.content)) {
      cleaned.push(message);
      continue;
    }
    const parts = message.content.filter((part) => {
      const p = part as { type?: string; toolCallId?: string };
      if (p.type !== "tool-result" || typeof p.toolCallId !== "string") {
        return true;
      }
      return survivingCallIds.has(p.toolCallId);
    });
    if (parts.length === 0) continue;
    cleaned.push({ ...message, content: parts } as ModelMessage);
  }

  return cleaned;
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

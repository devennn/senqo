import { getAgentConfigById } from "../repositories/agent.js";
import { listHandoffTopicsForInstructions } from "../repositories/handoff-topic-groups.js";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

export type HandoffTopicEvidence = {
  topicEntryId: string | null;
  topicLabel: string | null;
  source: "tool" | "reasoning" | "none";
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function topicTextMatches(haystack: string, topic: string, description: string): boolean {
  const title = normalize(topic);
  if (title.length >= 3 && haystack.includes(title)) return true;
  if (title.endsWith("s") && title.length >= 4 && haystack.includes(title.slice(0, -1))) {
    return true;
  }
  const words = title.split(" ").filter((w) => w.length >= 4);
  if (words.length > 0 && words.every((w) => haystack.includes(w))) return true;

  const desc = normalize(description);
  if (desc.length >= 8 && haystack.includes(desc)) return true;
  const descWords = desc.split(" ").filter((w) => w.length >= 5);
  if (descWords.length >= 2) {
    const hits = descWords.filter((w) => haystack.includes(w)).length;
    if (hits >= 2) return true;
  }
  return false;
}

/** Pull a topic id from free text (reasoning / tool reason). */
export function extractTopicEntryIdFromText(text: string): string | null {
  const matches = text.match(UUID_RE);
  return matches?.[0] ?? null;
}

/**
 * Recover handoff topic when structured output has no topicEntryId.
 * Prefer tool call id; else match operator reasoning / tool reason against agent topics.
 */
export async function resolveHandoffTopicFromEvidence(input: {
  workspaceId: string;
  agentConfigId: string;
  handoffCalled: boolean;
  topicEntryIdFromTool: string | null;
  reasoning: string | null;
  handoffReason?: string | null;
  expectedTopicEntryId?: string | null;
}): Promise<HandoffTopicEvidence> {
  if (!input.handoffCalled) {
    return { topicEntryId: null, topicLabel: null, source: "none" };
  }

  if (input.topicEntryIdFromTool?.trim()) {
    return {
      topicEntryId: input.topicEntryIdFromTool.trim(),
      topicLabel: null,
      source: "tool",
    };
  }

  const haystackRaw = [input.handoffReason ?? "", input.reasoning ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
  const haystack = normalize(haystackRaw);
  if (!haystack) {
    return { topicEntryId: null, topicLabel: null, source: "none" };
  }

  const agent = await getAgentConfigById(input.workspaceId, input.agentConfigId);
  if (!agent) {
    return { topicEntryId: null, topicLabel: null, source: "none" };
  }

  const groups = await listHandoffTopicsForInstructions(
    input.workspaceId,
    agent.handoff_topic_groups ?? [],
  );
  const entries = groups.flatMap((g) =>
    g.entries.map((e) => ({
      id: e.id,
      topic: e.topic.trim(),
      description: e.description.trim(),
    })),
  );
  if (entries.length === 0) {
    return { topicEntryId: null, topicLabel: null, source: "none" };
  }

  const idInText = extractTopicEntryIdFromText(haystackRaw)?.toLowerCase() ?? null;
  if (idInText) {
    const byId = entries.find((e) => e.id.toLowerCase() === idInText);
    if (byId) {
      return {
        topicEntryId: byId.id,
        topicLabel: byId.topic,
        source: "reasoning",
      };
    }
  }

  const expectedId = input.expectedTopicEntryId?.trim() || null;
  if (expectedId) {
    const expected = entries.find((e) => e.id === expectedId);
    if (
      expected &&
      topicTextMatches(haystack, expected.topic, expected.description)
    ) {
      return {
        topicEntryId: expected.id,
        topicLabel: expected.topic,
        source: "reasoning",
      };
    }
  }

  let best: { id: string; topic: string; score: number } | null = null;
  for (const entry of entries) {
    if (!topicTextMatches(haystack, entry.topic, entry.description)) continue;
    const score = normalize(entry.topic).length;
    if (!best || score > best.score) {
      best = { id: entry.id, topic: entry.topic, score };
    }
  }
  if (best) {
    return {
      topicEntryId: best.id,
      topicLabel: best.topic,
      source: "reasoning",
    };
  }

  return { topicEntryId: null, topicLabel: null, source: "none" };
}

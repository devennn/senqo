import type { ModelMessage } from "ai";
import { runAgentSession } from "../agent/agent.js";
import type { RunAgentResult } from "../types/agent.js";
import type { StoredUserImageUrlPart } from "../types/agent-multimodal.js";
import type { EvalTurn } from "../types/evals.js";
import {
  buildInboundAiUserTextForRun,
  isBareWhatsAppTypePlaceholderLine,
} from "../lib/trailing-user-messages.js";

const scope = "EvalSubject";

export type SubjectEvalResult = {
  sessionId: string;
  actualReply: string;
  reasoningForOperators: string | null;
  handoffCalled: boolean;
  handoffTopicEntryId: string | null;
  handoffReason: string | null;
  messages: RunAgentResult["messages"];
};

function splitTurnsForReplay(turns: EvalTurn[]): {
  history: EvalTurn[];
  inbound: EvalTurn[];
} {
  if (turns.length === 0) {
    return { history: [], inbound: [] };
  }

  let end = turns.length - 1;
  while (end >= 0 && turns[end]?.role === "user") {
    end -= 1;
  }
  const inboundStart = end + 1;
  if (inboundStart >= turns.length) {
    // No trailing user block — treat last turn as inbound if user, else fail closed with last user.
    const lastUserIdx = turns.map((t) => t.role).lastIndexOf("user");
    if (lastUserIdx < 0) {
      return { history: turns, inbound: [] };
    }
    return {
      history: turns.slice(0, lastUserIdx),
      inbound: turns.slice(lastUserIdx),
    };
  }
  return {
    history: turns.slice(0, inboundStart),
    inbound: turns.slice(inboundStart),
  };
}

function turnsToHistoryMessages(turns: EvalTurn[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  for (const turn of turns) {
    const text = turn.content.trim();
    if (!text && !turn.media?.signedUrl) continue;
    if (turn.role === "user") {
      const parts: Array<{ type: "text"; text: string } | { type: "image"; image: string }> =
        [];
      if (text) parts.push({ type: "text", text });
      if (turn.media?.signedUrl && turn.media.mimeType?.startsWith("image/")) {
        parts.push({ type: "image", image: turn.media.signedUrl });
      }
      messages.push({
        role: "user",
        content: parts.length > 0 ? parts : text || "(attachment)",
      } as ModelMessage);
    } else {
      messages.push({
        role: "assistant",
        content: text || "(empty)",
      });
    }
  }
  return messages;
}

function buildInboundFromTurns(inbound: EvalTurn[]): {
  message: string;
  userMediaParts: StoredUserImageUrlPart[];
} {
  const textLines = inbound
    .map((turn) => turn.content.trim())
    .filter((line) => line.length > 0);
  const message = buildInboundAiUserTextForRun(
    textLines.length > 0 ? textLines : inbound.map(() => ""),
  );

  const userMediaParts: StoredUserImageUrlPart[] = [];
  for (const turn of inbound) {
    const url = turn.media?.signedUrl?.trim();
    const mime = turn.media?.mimeType?.trim() ?? "";
    if (!url || !mime.startsWith("image/")) continue;
    userMediaParts.push({
      type: "image_url",
      image_url: { url, detail: "auto" },
    });
  }

  // If only placeholders, still produce a usable prompt.
  if (
    textLines.every((line) => !line || isBareWhatsAppTypePlaceholderLine(line)) &&
    userMediaParts.length === 0 &&
    inbound.length > 0
  ) {
    return {
      message: inbound.map((t) => t.content).filter(Boolean).join("\n") || message,
      userMediaParts,
    };
  }

  return { message, userMediaParts };
}

export async function runSubjectEval(input: {
  workspaceId: string;
  agentConfigId: string;
  turns: EvalTurn[];
}): Promise<SubjectEvalResult | null> {
  const { history, inbound } = splitTurnsForReplay(input.turns);
  if (inbound.length === 0) {
    console.error(`[${scope}/runSubjectEval] Failed query: no inbound user turns`);
    return null;
  }

  const historyOverride = turnsToHistoryMessages(history);
  const { message, userMediaParts } = buildInboundFromTurns(inbound);
  const sessionId = crypto.randomUUID();

  try {
    const result = await runAgentSession({
      workspaceId: input.workspaceId,
      agentConfigId: input.agentConfigId,
      sessionId,
      message,
      dryRun: true,
      historyOverride,
      userMediaParts: userMediaParts.length > 0 ? userMediaParts : undefined,
    });

    if (!result) {
      console.error(`[${scope}/runSubjectEval] Failed query: runAgentSession returned null`);
      return null;
    }

    const actualReply = result.messages
      .map((m) => m.text.trim())
      .filter(Boolean)
      .join("\n\n");

    const reasoning = result.reasoningForOperators?.trim() || null;

    console.info(
      `[${scope}/runSubjectEval] Success: sessionId=${result.sessionId} bubbles=${result.messages.length}`,
    );
    return {
      sessionId: result.sessionId,
      actualReply,
      reasoningForOperators: reasoning,
      handoffCalled: Boolean(result.handoffCalled),
      handoffTopicEntryId: result.handoffTopicEntryId ?? null,
      handoffReason: result.handoffReason ?? null,
      messages: result.messages,
    };
  } catch (error) {
    console.error(`[${scope}/runSubjectEval] Unexpected error: ${String(error)}`);
    return null;
  }
}

export { splitTurnsForReplay };

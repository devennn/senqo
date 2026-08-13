import {
  THREAD_EVENT_HANDOFF_TO_HUMAN,
  THREAD_EVENT_MANUAL_TOGGLE,
} from "../lib/conversation-thread-events.js";
import type { ConversationMessage } from "../types/repositories.js";
import type { EvalTurn, EvalTurnMedia } from "../types/evals.js";

function isThreadEvent(metadata: Record<string, unknown> | null): boolean {
  const event = typeof metadata?.thread_event === "string" ? metadata.thread_event : null;
  return event === THREAD_EVENT_HANDOFF_TO_HUMAN || event === THREAD_EVENT_MANUAL_TOGGLE;
}

function toMedia(media: ConversationMessage["media"]): EvalTurnMedia | null {
  if (!media) return null;
  return {
    path: media.path,
    storageBucket: media.storageBucket,
    fileName: media.fileName,
    mimeType: media.mimeType,
    caption: media.caption,
    sourceUrl: media.sourceUrl,
    signedUrl: media.signedUrl,
    fileSizeBytes: media.fileSizeBytes,
  };
}

/** Map inbox conversation messages into eval turns (skip thread markers). */
export function conversationMessagesToEvalTurns(
  messages: ConversationMessage[],
): EvalTurn[] {
  const turns: EvalTurn[] = [];
  for (const message of messages) {
    const metadata =
      message.metadata && typeof message.metadata === "object"
        ? message.metadata
        : null;
    if (isThreadEvent(metadata)) continue;

    const role = message.role === "user" ? "user" : "assistant";
    const turn: EvalTurn = {
      role,
      content: typeof message.content === "string" ? message.content : "",
    };
    const media = toMedia(message.media);
    if (media) turn.media = media;

    if (role === "assistant") {
      const reasoning =
        typeof metadata?.ai_reasoning === "string"
          ? metadata.ai_reasoning.trim()
          : "";
      if (reasoning) turn.whyReply = reasoning;
    }

    turns.push(turn);
  }
  return turns;
}

/**
 * Drop trailing assistant turns so the case ends on the customer ask.
 * The subject run regenerates that reply; keeping the old one looks like a run and duplicates history.
 */
export function stripTrailingAssistantTurns(turns: EvalTurn[]): EvalTurn[] {
  let end = turns.length;
  while (end > 0 && turns[end - 1]?.role === "assistant") {
    end -= 1;
  }
  return end === turns.length ? turns : turns.slice(0, end);
}

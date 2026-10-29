import { generateText, type ModelMessage, stepCountIs } from "ai";
import { z } from "zod";
import { getChatLLM } from "./llm.js";
import { createAdminChatTools } from "./admin-chat-tools.js";
import {
  createAdminChatMessage,
  listAdminChatMessages,
} from "../repositories/admin-chat.js";

const scope = "AdminChat";

/** Max stored messages replayed to the model each turn. */
const HISTORY_LIMIT = 100;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_STEPS = 8;

const chatInputSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export const ADMIN_CHAT_MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH;

export function validateAdminChatInput(payload: unknown): { ok: true; message: string } | { ok: false } {
  const parsed = chatInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false };
  return { ok: true, message: parsed.data.message };
}

function buildSystemPrompt(): string {
  return [
    "You are the Senqo instance admin assistant. You help the platform admin (instance superadmin) of a self-hosted Senqo WhatsApp automation instance.",
    "You can answer questions about this instance's settings, workspaces, and users, and you can change the public registration setting when asked.",
    "Use the provided tools for any question about platform state instead of guessing. Data the admin sees in this chat must reflect reality.",
    "You cannot create or delete workspaces or users — for those actions point the admin to the Instance admin page controls.",
    "Be concise and factual. When you change a setting, state clearly what changed.",
    `Current date: ${new Date().toISOString()}`,
  ].join("\n");
}

function toModelMessages(
  history: { role: string; content: string }[],
  message: string,
): ModelMessage[] {
  const historyMessages = history.map<ModelMessage>((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  return [...historyMessages, { role: "user", content: message }];
}

export type AdminChatResult =
  | { ok: true; reply: string }
  | { ok: false; message: string };

export async function runAdminChat(
  userId: string,
  message: string,
): Promise<AdminChatResult> {
  const history = await listAdminChatMessages(userId, HISTORY_LIMIT);

  const result = await generateText({
    model: getChatLLM(),
    system: buildSystemPrompt(),
    messages: toModelMessages(history, message),
    tools: createAdminChatTools(),
    stopWhen: stepCountIs(MAX_TOOL_STEPS),
  });

  const reply = result.text.trim();
  if (!reply) {
    console.error(`[${scope}/runAdminChat] Unexpected error: empty reply userId=${userId}`);
    return { ok: false, message: "empty_reply" };
  }

  const saved = await createAdminChatMessage(userId, "assistant", reply);
  if (!saved) return { ok: false, message: "persist_failed" };

  console.info(`[${scope}/runAdminChat] Success: userId=${userId} replyLength=${reply.length}`);
  return { ok: true, reply };
}

/** Persist the admin's question before the model runs, so it survives failures. */
export async function persistAdminChatUserMessage(
  userId: string,
  message: string,
): Promise<boolean> {
  const saved = await createAdminChatMessage(userId, "user", message);
  return saved !== null;
}

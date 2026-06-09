import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { env } from "../lib/env.js";

const scope = "TaskMessageFormatter";
const openrouter = createOpenRouter({
  apiKey: env.openRouterApiKey,
});

const formatterSchema = z.object({
  message: z.string().min(1),
  fileUrl: z.url().nullable(),
});

export async function formatTaskOutboundMessage(input: {
  message: string;
  fileUrl?: string | null;
}): Promise<{ message: string; fileUrl: string | null }> {
  const rawMessage = decodeURIComponent(input.message).trim();
  const rawFileUrl = input.fileUrl?.trim() || null;
  if (!rawMessage) {
    return { message: "", fileUrl: rawFileUrl };
  }

  try {
    const result = await generateText({
      model: openrouter.chat("x-ai/grok-4.1-fast"),
      output: Output.object({
        schema: formatterSchema,
      }),
      prompt: [
        "You format outbound WhatsApp outreach content.",
        "Return clean final message body plus optional file URL.",
        "If the input includes scaffolding like 'Send this text', 'Template:', 'Image file:', strip those and keep only recipient-facing message text.",
        "Preserve original tone and intent.",
        "Keep line breaks when useful.",
        "Message must be plain text only (no URL encoding like %0A, no markdown fences, no JSON wrappers).",
        "Only return fileUrl when it is a valid absolute URL.",
        "",
        `Provided file URL field: ${rawFileUrl ?? "(none)"}`,
        "",
        "Raw instruction:",
        rawMessage,
      ].join("\n"),
    });

    const message = result.output.message.replace(/\r\n/g, "\n").trim();
    const fileUrl = result.output.fileUrl?.trim() || null;
    if (!message) {
      console.error(`[${scope}/formatTaskOutboundMessage] Failed query: empty AI output`);
      return { message: rawMessage, fileUrl: rawFileUrl };
    }
    console.info(`[${scope}/formatTaskOutboundMessage] Success: userId=formatter`);
    return { message, fileUrl };
  } catch (error) {
    console.error(`[${scope}/formatTaskOutboundMessage] Unexpected error: ${String(error)}`);
    return { message: rawMessage, fileUrl: rawFileUrl };
  }
}

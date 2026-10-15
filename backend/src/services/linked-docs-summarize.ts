import { generateText, Output } from "ai";
import { z } from "zod";
import { getFormatterLLM } from "../agent/llm.js";

const scope = "LinkedDocsSummarize";

/** Cap of file text sent to the model for summarization. */
export const LINKED_DOC_SUMMARY_EXCERPT_MAX_CHARS = 12_000;

/** Soft max for the stored, internal file description. */
export const LINKED_DOC_DESCRIPTION_MAX_CHARS = 600;

const llmSchema = z.object({
  description: z.string().min(1).max(800),
});

export type LinkedDocSummarizeResult =
  | { ok: true; description: string }
  | { ok: false; message: string };

const SYSTEM_RULES = [
  "You write an internal description of a file for a workspace's AI agent setup.",
  "The description is stored with the file and shown to workspace operators; it must describe the file itself, never how to use it.",
  "Requirements:",
  "- 2–4 sentences, up to 600 characters total.",
  "- Describe what the file contains: document type, subject areas, structure (sections, tabs, columns), and concrete details visible in the excerpt (topics, date ranges, units, languages).",
  "- Be specific and informative; prefer real names and values from the excerpt over vague phrases.",
  "- Never include instructions, tool names, or usage advice (no 'use this to…', no 'the agent must…', no send rules).",
  "- Do not invent numbers, names, or facts not supported by the excerpt.",
  "- If the excerpt is binary or thin, describe the file from its name and mime type only; do not guess at specific contents.",
  "- No markdown, no bullet lists, no preamble.",
].join("\n");

export function extractTextPreviewForSummary(input: {
  fileName: string;
  mimeType: string;
  bytes?: Uint8Array | null;
  text?: string | null;
}): string {
  if (typeof input.text === "string" && input.text.trim()) {
    return input.text.trim().slice(0, LINKED_DOC_SUMMARY_EXCERPT_MAX_CHARS);
  }
  const bytes = input.bytes;
  if (!bytes || bytes.byteLength === 0) {
    return `[No content preview. fileName=${input.fileName}; mimeType=${input.mimeType}]`;
  }
  const mime = input.mimeType.toLowerCase();
  const name = input.fileName.toLowerCase();
  const textLike =
    mime.startsWith("text/") ||
    mime.includes("csv") ||
    mime.includes("json") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    name.endsWith(".tsv");
  if (textLike) {
    return new TextDecoder("utf-8", { fatal: false })
      .decode(bytes)
      .slice(0, LINKED_DOC_SUMMARY_EXCERPT_MAX_CHARS);
  }
  return `[Binary/office file ${input.fileName} (${input.mimeType}), ${bytes.byteLength} bytes. No text extract available.]`;
}

export async function summarizeLinkedDocContent(input: {
  fileName: string;
  mimeType: string;
  excerpt: string;
}): Promise<LinkedDocSummarizeResult> {
  const fileName = input.fileName.trim();
  if (!fileName) {
    return { ok: false, message: "File name is required." };
  }
  const excerpt = input.excerpt.trim().slice(0, LINKED_DOC_SUMMARY_EXCERPT_MAX_CHARS);
  if (!excerpt) {
    return { ok: false, message: "File content is required." };
  }

  try {
    const result = await generateText({
      model: getFormatterLLM(),
      output: Output.object({ schema: llmSchema }),
      prompt: [
        SYSTEM_RULES,
        "",
        `fileName: ${fileName}`,
        `mimeType: ${input.mimeType.trim() || "application/octet-stream"}`,
        "",
        "File excerpt:",
        excerpt,
      ].join("\n"),
    });

    let description = result.output.description.trim().replace(/\s+/g, " ");
    if (description.length > LINKED_DOC_DESCRIPTION_MAX_CHARS) {
      description = `${description.slice(0, LINKED_DOC_DESCRIPTION_MAX_CHARS - 1).trimEnd()}…`;
    }
    if (!description) {
      return { ok: false, message: "Empty summary from model." };
    }

    console.info(
      `[${scope}/summarizeLinkedDocContent] Success: fileName=${fileName} chars=${description.length}`,
    );
    return { ok: true, description };
  } catch (error) {
    console.error(
      `[${scope}/summarizeLinkedDocContent] Unexpected error: ${String(error)}`,
    );
    return { ok: false, message: "Could not summarize file." };
  }
}

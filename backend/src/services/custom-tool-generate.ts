import { generateText, Output } from "ai";
import { z } from "zod";
import { getChatLLM } from "../agent/llm.js";
import { compileCustomToolSource } from "./custom-tool-compile.js";

const scope = "CustomToolGenerate";

export const CUSTOM_TOOL_GENERATE_PROMPT_MAX_CHARS = 20_000;

const llmDraftSchema = z.object({
  displayName: z.string().min(1),
  description: z.string(),
  requiredEnv: z.array(z.string()),
  sourceCode: z.string().min(1),
});

export type CustomToolGenerateDraft = {
  displayName: string;
  description: string;
  requiredEnv: string[];
  sourceCode: string;
};

export type CustomToolGenerateResult =
  | { ok: true; draft: CustomToolGenerateDraft }
  | { ok: false; message: string };

const SYSTEM_RULES = [
  "You write Senqo custom tools: isolated TypeScript modules the WhatsApp agent can call.",
  "Return displayName, description, requiredEnv, and sourceCode only.",
  "Rules for sourceCode:",
  "- Export exactly one async function: execute(input, ctx)",
  "- Type input inline, e.g. input: { city: string; unit?: string }",
  "- ctx shape: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string; agentConfigId?: string }",
  "- Use fetch for HTTP. No import/require, no Node APIs, no filesystem, no process.env",
  "- Read secrets only via ctx.env.SECRET_NAME; list those names in requiredEnv (SCREAMING_SNAKE_CASE)",
  "- Prefer returning { ok: true, ... } or { ok: false, error: string }",
  "- Keep code concise and runnable; invent realistic endpoints only when the reference implies them",
  "description: short text telling the AI when to call this tool and what it returns.",
  "displayName: short human title (Title Case).",
  "If the reference is vague, still produce a minimal useful tool matching the intent.",
].join("\n");

export async function generateCustomToolDraft(prompt: string): Promise<CustomToolGenerateResult> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { ok: false, message: "Reference text is required." };
  }
  if (trimmed.length > CUSTOM_TOOL_GENERATE_PROMPT_MAX_CHARS) {
    return {
      ok: false,
      message: `Reference text exceeds ${CUSTOM_TOOL_GENERATE_PROMPT_MAX_CHARS} characters.`,
    };
  }

  try {
    const result = await generateText({
      model: getChatLLM(),
      output: Output.object({ schema: llmDraftSchema }),
      prompt: [SYSTEM_RULES, "", "Operator reference:", trimmed].join("\n"),
    });

    const out = result.output;
    const requiredEnv = out.requiredEnv
      .map((name) => name.trim())
      .filter(Boolean);

    const compiled = await compileCustomToolSource(out.sourceCode, { requiredEnv });
    if (!compiled.ok) {
      console.error(`[${scope}/generate] Failed compile: ${compiled.error}`);
      return {
        ok: false,
        message: "Generated code was invalid. Adjust the reference and try again.",
      };
    }

    const draft: CustomToolGenerateDraft = {
      displayName: out.displayName.trim(),
      description: out.description.trim(),
      requiredEnv: compiled.metadata.requiredEnv,
      sourceCode: compiled.metadata.normalizedSource,
    };

    console.info(
      `[${scope}/generate] Success: displayName=${draft.displayName} env=${draft.requiredEnv.length}`,
    );
    return { ok: true, draft };
  } catch (error) {
    console.error(`[${scope}/generate] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not generate tool code." };
  }
}

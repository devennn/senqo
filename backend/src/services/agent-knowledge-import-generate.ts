import { generateText, Output } from "ai";
import { z } from "zod";
import { getChatLLM } from "../agent/llm.js";
import type { ExtractedDocument } from "../lib/agent-knowledge-import-extract.js";
import type {
  AgentKnowledgeImportDraft,
  AgentKnowledgeImportTarget,
} from "../types/agent-knowledge-import.js";

const scope = "AgentKnowledgeImportGenerate";

const llmDraftSchema = z.object({
  contextGroups: z.array(
    z.object({
      name: z.string().min(1),
      facts: z.array(
        z.object({
          title: z.string().min(1),
          bodyText: z.string().min(1),
        }),
      ),
    }),
  ),
  skills: z.array(
    z.object({
      displayName: z.string().min(1),
      description: z.string(),
      content: z.string().min(1),
    }),
  ),
  templateGroups: z.array(
    z.object({
      name: z.string().min(1),
      entries: z.array(
        z.object({
          questionText: z.string().min(1),
          answerText: z.string().min(1),
        }),
      ),
    }),
  ),
});

function withId<T extends Record<string, unknown>>(
  prefix: string,
  row: T,
): T & { id: string } {
  return { id: `${prefix}-${crypto.randomUUID()}`, ...row };
}

export async function generateAgentKnowledgeImportDraft(input: {
  profileName: string;
  targets: AgentKnowledgeImportTarget[];
  focusHint: string;
  documents: ExtractedDocument[];
}): Promise<AgentKnowledgeImportDraft> {
  const docBlock = input.documents
    .map((doc) => `### ${doc.name}\n${doc.text}`)
    .join("\n\n");

  try {
    const result = await generateText({
      model: getChatLLM(),
      output: Output.object({ schema: llmDraftSchema }),
      prompt: [
        "Extract workspace knowledge for a WhatsApp support agent.",
        `Agent profile name: ${input.profileName}`,
        `Only generate sections for: ${input.targets.join(", ")}`,
        input.focusHint.trim()
          ? `Operator focus: ${input.focusHint.trim()}`
          : "",
        "Rules:",
        "- Use only facts present in the documents; do not invent policies or numbers.",
        "- context: grouped facts with short titles and concise bodies",
        "- skills: markdown playbooks with ## headings",
        "- templates: customer intent phrasing plus verbatim WhatsApp-ready replies",
        "- Return empty arrays for sections not requested",
        "- Omit sections with no grounded content",
        "",
        docBlock,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const out = result.output;

    const draft: AgentKnowledgeImportDraft = {
      contextGroups: input.targets.includes("context")
        ? out.contextGroups.map((group) =>
            withId("ctx-group", {
              name: group.name.trim(),
              facts: group.facts.map((fact) =>
                withId("ctx-fact", {
                  title: fact.title.trim(),
                  bodyText: fact.bodyText.trim(),
                }),
              ),
            }),
          )
        : [],
      skills: input.targets.includes("skills")
        ? out.skills.map((skill) =>
            withId("skill", {
              displayName: skill.displayName.trim(),
              description: skill.description.trim(),
              content: skill.content.trim(),
            }),
          )
        : [],
      templateGroups: input.targets.includes("templates")
        ? out.templateGroups.map((group) =>
            withId("tpl-group", {
              name: group.name.trim(),
              entries: group.entries.map((entry) =>
                withId("tpl-entry", {
                  questionText: entry.questionText.trim(),
                  answerText: entry.answerText.trim(),
                }),
              ),
            }),
          )
        : [],
    };

    console.info(
      `[${scope}/generate] Success: profileName=${input.profileName} context=${draft.contextGroups.length} skills=${draft.skills.length} templates=${draft.templateGroups.length}`,
    );
    return draft;
  } catch (error) {
    console.error(`[${scope}/generate] Unexpected error: ${String(error)}`);
    throw new Error("Could not generate import preview.");
  }
}

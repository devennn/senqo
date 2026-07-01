import { z } from "zod";

export const agentKnowledgeImportTargetSchema = z.enum(["context", "skills", "templates"]);

export const agentKnowledgeImportTargetsSchema = z
  .array(agentKnowledgeImportTargetSchema)
  .min(1)
  .max(3);

export const draftContextFactSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  bodyText: z.string(),
});

export const draftContextGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  facts: z.array(draftContextFactSchema),
});

export const draftSkillSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  description: z.string(),
  content: z.string(),
});

export const draftTemplateEntrySchema = z.object({
  id: z.string().min(1),
  questionText: z.string(),
  answerText: z.string(),
});

export const draftTemplateGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  entries: z.array(draftTemplateEntrySchema),
});

export const agentKnowledgeImportDraftSchema = z.object({
  contextGroups: z.array(draftContextGroupSchema),
  skills: z.array(draftSkillSchema),
  templateGroups: z.array(draftTemplateGroupSchema),
});

export const agentKnowledgeImportWorkspaceRefsSchema = z.object({
  contextGroups: z.record(z.string(), z.string()).default({}),
  templateGroups: z.record(z.string(), z.string()).default({}),
});

export const agentKnowledgeImportApplySchema = z.object({
  profileName: z.string().max(80),
  draft: agentKnowledgeImportDraftSchema,
  workspaceRefs: agentKnowledgeImportWorkspaceRefsSchema.optional(),
  jobId: z.string().uuid().optional(),
  selection: z.unknown().optional(),
});

export type AgentKnowledgeImportWorkspaceRefs = z.infer<typeof agentKnowledgeImportWorkspaceRefsSchema>;

export type AgentKnowledgeImportTarget = z.infer<typeof agentKnowledgeImportTargetSchema>;
export type AgentKnowledgeImportDraft = z.infer<typeof agentKnowledgeImportDraftSchema>;

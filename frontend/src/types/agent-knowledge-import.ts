export type AgentKnowledgeImportTarget = "context" | "skills" | "templates";

export type AgentKnowledgeImportFile = {
  id: string;
  file: File;
};

export type DraftContextFact = {
  id: string;
  title: string;
  bodyText: string;
};

export type DraftContextGroup = {
  id: string;
  name: string;
  facts: DraftContextFact[];
};

export type DraftSkill = {
  id: string;
  displayName: string;
  description: string;
  content: string;
};

export type DraftTemplateEntry = {
  id: string;
  questionText: string;
  answerText: string;
};

export type DraftTemplateGroup = {
  id: string;
  name: string;
  entries: DraftTemplateEntry[];
};

export type AgentKnowledgeImportDraft = {
  contextGroups: DraftContextGroup[];
  skills: DraftSkill[];
  templateGroups: DraftTemplateGroup[];
};

export type AgentKnowledgeImportPhase = "upload" | "processing" | "review" | "applied";

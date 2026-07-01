import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Spinner } from "@/components/ui/spinner";
import { useAgentKnowledgeImport } from "@/hooks/useAgentKnowledgeImport";
import { AgentKnowledgeImportFileDropzone } from "@/pages/dashboard/components/agent-knowledge-import-file-dropzone";
import {
  AgentKnowledgeImportAppliedBanner,
  AgentKnowledgeImportReviewBody,
  AgentKnowledgeImportReviewFooter,
} from "@/pages/dashboard/components/agent-knowledge-import-review-panel";
import { AgentKnowledgeImportTargetsForm } from "@/pages/dashboard/components/agent-knowledge-import-targets-form";

type Props = {
  agentId: string;
  profileName: string;
  resumeJobId?: string | null;
  onDone?: () => void;
  onApplied?: () => void;
  onRunInBackground?: () => void;
};

export function AgentKnowledgeImportPanel({
  agentId,
  profileName,
  resumeJobId,
  onDone,
  onApplied,
  onRunInBackground,
}: Props) {
  const {
    phase,
    files,
    targets,
    focusHint,
    draft,
    selection,
    applyingTarget,
    pendingCount,
    fileError,
    generateError,
    canGenerate,
    addFiles,
    removeFile,
    toggleTarget,
    setFocusHint,
    generate,
    reset,
    applyAllPending,
    acceptAndApply,
    applyError,
    updateDraft,
    discardContextGroup,
    discardContextFact,
    discardSkill,
    discardTemplateGroup,
    discardTemplateEntry,
  } = useAgentKnowledgeImport({ agentId, profileName, resumeJobId, onApplied });

  if (phase === "processing") {
    return (
      <div className="space-y-4 px-6 py-10" role="status" aria-live="polite">
        <div className="flex flex-col items-center justify-center gap-4">
          <Spinner className="size-10" />
          <div className="max-w-md space-y-1 text-center">
            <p className="text-sm font-medium text-foreground">Analyzing docs for {profileName}</p>
            <p className="text-sm text-muted-foreground">
              This can take a few minutes. You can close this dialog and come back later from Import docs.
            </p>
          </div>
        </div>
        {onRunInBackground ? (
          <div className="flex justify-center">
            <Button type="button" variant="outline" onClick={onRunInBackground}>
              Run in background
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === "applied") {
    return (
      <div className="px-6 py-4">
        <AgentKnowledgeImportAppliedBanner
          profileName={profileName}
          onStartOver={reset}
          onClose={onDone}
        />
      </div>
    );
  }

  if (phase === "review" && draft && selection) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <AgentKnowledgeImportReviewBody
            draft={draft}
            selection={selection}
            applyingTarget={applyingTarget}
            profileName={profileName}
            onDraftChange={updateDraft}
            onAddContextGroup={(groupId) => {
              void acceptAndApply({ kind: "context-group", groupId });
            }}
            onDiscardContextGroup={discardContextGroup}
            onAddContextFact={(groupId, factId) => {
              void acceptAndApply({ kind: "context-fact", groupId, factId });
            }}
            onDiscardContextFact={discardContextFact}
            onAddSkill={(skillId) => {
              void acceptAndApply({ kind: "skill", skillId });
            }}
            onDiscardSkill={discardSkill}
            onAddTemplateGroup={(groupId) => {
              void acceptAndApply({ kind: "template-group", groupId });
            }}
            onDiscardTemplateGroup={discardTemplateGroup}
            onAddTemplateEntry={(groupId, entryId) => {
              void acceptAndApply({ kind: "template-entry", groupId, entryId });
            }}
            onDiscardTemplateEntry={discardTemplateEntry}
          />
        </div>
        <AgentKnowledgeImportReviewFooter
          pendingCount={pendingCount}
          applyError={applyError}
          applyingTarget={applyingTarget}
          onBack={reset}
          onApplyAllPending={applyAllPending}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 px-6 py-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{files.length > 0 ? "Uploaded files" : "Upload company docs"}</span>
            <InlineHelpHint label="What to upload">
              <p>
                Add PDFs, CSV exports, or Markdown docs your team already uses. AI drafts workspace context, skills,
                and response templates for {profileName}. Processing runs in the background so you can return later.
              </p>
            </InlineHelpHint>
          </CardTitle>
          <CardDescription>
            {files.length > 0
              ? `${files.length} file${files.length === 1 ? "" : "s"} ready — choose outputs on the right, then generate.`
              : "Drop files or browse to start."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentKnowledgeImportFileDropzone
            files={files}
            fileError={fileError}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
          />
        </CardContent>
      </Card>

      <AgentKnowledgeImportTargetsForm
        targets={targets}
        focusHint={focusHint}
        canGenerate={canGenerate}
        generateError={generateError}
        profileName={profileName}
        onToggleTarget={toggleTarget}
        onFocusHintChange={setFocusHint}
        onGenerate={() => {
          void generate();
        }}
      />
    </div>
  );
}

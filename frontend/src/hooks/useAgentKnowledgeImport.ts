import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENT_KNOWLEDGE_IMPORT_MAX_FILES,
  validateAgentKnowledgeImportFile,
} from "@/lib/agent-knowledge-import";
import {
  buildPartialDraftForTarget,
  countPendingItems,
  createEmptyWorkspaceRefs,
  createSelectionFromDraft,
  discardContextGroup,
  discardTemplateGroup,
  filterDraftForPendingApply,
  isEmptyDraft,
  isImportReviewComplete,
  markSelectionApplied,
  mergeWorkspaceRefs,
  selectionForAcceptTarget,
  setContextFactDisposition,
  setSkillDisposition,
  setTemplateEntryDisposition,
} from "@/lib/agent-knowledge-import-selection";
import {
  applyAgentKnowledgeImport,
  dismissAgentKnowledgeImportJob,
  getAgentKnowledgeImportJob,
  saveAgentKnowledgeImportJobProgress,
  startAgentKnowledgeImportJob,
} from "@/lib/agent-knowledge-import-api";
import type {
  AgentKnowledgeImportDraft,
  AgentKnowledgeImportFile,
  AgentKnowledgeImportPhase,
  AgentKnowledgeImportTarget,
} from "@/types/agent-knowledge-import";
import type { AgentKnowledgeImportJob } from "@/types/agent-knowledge-import-job";
import { AGENT_KNOWLEDGE_IMPORT_POLL_MS } from "@/types/agent-knowledge-import-job";
import type {
  AgentKnowledgeImportApplyTarget,
  AgentKnowledgeImportSelection,
  AgentKnowledgeImportWorkspaceRefs,
} from "@/types/agent-knowledge-import-selection";

function makeFileEntry(file: File): AgentKnowledgeImportFile {
  return { id: crypto.randomUUID(), file };
}

function hydrateFromJob(
  job: AgentKnowledgeImportJob,
  setters: {
    setJobId: (id: string) => void;
    setDraft: (draft: AgentKnowledgeImportDraft | null) => void;
    setSelection: (selection: AgentKnowledgeImportSelection | null) => void;
    setWorkspaceRefs: (refs: AgentKnowledgeImportWorkspaceRefs) => void;
    setPhase: (phase: AgentKnowledgeImportPhase) => void;
    setGenerateError: (message: string | null) => void;
  },
): void {
  setters.setJobId(job.id);
  setters.setWorkspaceRefs(job.workspaceRefs ?? createEmptyWorkspaceRefs());

  if (job.status === "ready" && job.draft) {
    setters.setDraft(job.draft);
    setters.setSelection(
      (job.selection as AgentKnowledgeImportSelection | null) ?? createSelectionFromDraft(job.draft),
    );
    setters.setPhase("review");
    setters.setGenerateError(null);
    return;
  }

  if (job.status === "queued" || job.status === "processing") {
    setters.setPhase("processing");
    setters.setGenerateError(null);
    return;
  }

  if (job.status === "failed") {
    setters.setGenerateError(job.errorMessage ?? "Import failed.");
    setters.setPhase("upload");
  }
}

type ImportScope = {
  agentId: string;
  profileName: string;
  resumeJobId?: string | null;
  onApplied?: () => void;
  onCleared?: () => void;
};

export function useAgentKnowledgeImport({
  agentId,
  profileName,
  resumeJobId,
  onApplied,
  onCleared,
}: ImportScope) {
  const [phase, setPhase] = useState<AgentKnowledgeImportPhase>("upload");
  const [jobId, setJobId] = useState<string | null>(resumeJobId ?? null);
  const [files, setFiles] = useState<AgentKnowledgeImportFile[]>([]);
  const [targets, setTargets] = useState<AgentKnowledgeImportTarget[]>([
    "context",
    "skills",
    "templates",
  ]);
  const [focusHint, setFocusHint] = useState("");
  const [draft, setDraft] = useState<AgentKnowledgeImportDraft | null>(null);
  const [selection, setSelection] = useState<AgentKnowledgeImportSelection | null>(null);
  const [workspaceRefs, setWorkspaceRefs] = useState<AgentKnowledgeImportWorkspaceRefs>(
    createEmptyWorkspaceRefs(),
  );
  const workspaceRefsRef = useRef(workspaceRefs);
  workspaceRefsRef.current = workspaceRefs;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const jobIdRef = useRef(jobId);
  jobIdRef.current = jobId;
  const [applyingTarget, setApplyingTarget] = useState<AgentKnowledgeImportApplyTarget | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const loadJob = useCallback(
    async (id: string) => {
      const result = await getAgentKnowledgeImportJob(agentId, id);
      hydrateFromJob(result.job, {
        setJobId,
        setDraft,
        setSelection,
        setWorkspaceRefs,
        setPhase,
        setGenerateError,
      });
    },
    [agentId],
  );

  useEffect(() => {
    if (resumeJobId) {
      void loadJob(resumeJobId);
    }
  }, [loadJob, resumeJobId]);

  useEffect(() => {
    if (!jobId || phase !== "processing") return;

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const result = await getAgentKnowledgeImportJob(agentId, jobId);
        if (cancelled) return;
        hydrateFromJob(result.job, {
          setJobId,
          setDraft,
          setSelection,
          setWorkspaceRefs,
          setPhase,
          setGenerateError,
        });
        if (result.job.status === "queued" || result.job.status === "processing") {
          timer = window.setTimeout(() => {
            void poll();
          }, AGENT_KNOWLEDGE_IMPORT_POLL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setGenerateError(err instanceof Error ? err.message : "Could not check import status.");
          setPhase("upload");
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [agentId, jobId, phase]);

  const persistJobState = useCallback(async () => {
    const currentJobId = jobIdRef.current;
    const currentDraft = draftRef.current;
    const currentSelection = selectionRef.current;
    if (!currentJobId || !currentDraft || !currentSelection) return;
    try {
      await saveAgentKnowledgeImportJobProgress(agentId, currentJobId, {
        draft: currentDraft,
        selection: currentSelection,
        workspaceRefs: workspaceRefsRef.current,
      });
    } catch {
      // Best-effort persistence for resume later.
    }
  }, [agentId]);

  useEffect(() => {
    if (phase !== "review" || !jobId) return;
    const timer = window.setTimeout(() => {
      void persistJobState();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, jobId, phase, persistJobState, selection, workspaceRefs]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;

    setFileError(null);
    setFiles((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (next.length >= AGENT_KNOWLEDGE_IMPORT_MAX_FILES) {
          setFileError(`You can upload up to ${AGENT_KNOWLEDGE_IMPORT_MAX_FILES} files.`);
          break;
        }
        const check = validateAgentKnowledgeImportFile(file);
        if (!check.ok) {
          setFileError(check.message);
          continue;
        }
        if (next.some((f) => f.file.name === file.name && f.file.size === file.size)) continue;
        next.push(makeFileEntry(file));
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setFileError(null);
  }, []);

  const toggleTarget = useCallback((target: AgentKnowledgeImportTarget) => {
    setTargets((prev) =>
      prev.includes(target) ? prev.filter((t) => t !== target) : [...prev, target],
    );
  }, []);

  const canGenerate = files.length > 0 && targets.length > 0 && phase === "upload";

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setGenerateError(null);
    setApplyError(null);
    setPhase("processing");
    try {
      const result = await startAgentKnowledgeImportJob(agentId, {
        profileName,
        files: files.map((entry) => entry.file),
        targets,
        focusHint,
      });
      setJobId(result.job.id);
      if (result.job.status === "ready" && result.job.draft) {
        hydrateFromJob(result.job, {
          setJobId,
          setDraft,
          setSelection,
          setWorkspaceRefs,
          setPhase,
          setGenerateError,
        });
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Could not start import.");
      setPhase("upload");
    }
  }, [agentId, canGenerate, files, focusHint, profileName, targets]);

  const dismissCurrentJob = useCallback(async () => {
    const currentJobId = jobIdRef.current;
    if (!currentJobId) return;
    try {
      await dismissAgentKnowledgeImportJob(agentId, currentJobId);
    } catch {
      // Best-effort — local clear still proceeds.
    }
  }, [agentId]);

  const runApply = useCallback(
    async (payload: AgentKnowledgeImportDraft, nextSelection: AgentKnowledgeImportSelection) => {
      if (isEmptyDraft(payload)) {
        throw new Error("Accept at least one item before adding.");
      }
      return applyAgentKnowledgeImport(agentId, {
        profileName,
        draft: payload,
        workspaceRefs: workspaceRefsRef.current,
        jobId: jobIdRef.current ?? undefined,
        selection: nextSelection,
      });
    },
    [agentId, profileName],
  );

  const applyWithSelection = useCallback(
    async (payload: AgentKnowledgeImportDraft, nextSelection: AgentKnowledgeImportSelection) => {
      if (!draft) return;
      setApplyError(null);
      const result = await runApply(payload, nextSelection);
      const appliedSelection = markSelectionApplied(nextSelection, payload);
      const nextRefs = mergeWorkspaceRefs(workspaceRefsRef.current, result.workspaceRefs);
      setSelection(appliedSelection);
      setWorkspaceRefs(nextRefs);
      if (jobIdRef.current) {
        await saveAgentKnowledgeImportJobProgress(agentId, jobIdRef.current, {
          draft,
          selection: appliedSelection,
          workspaceRefs: nextRefs,
        }).catch(() => undefined);
      }
      if (isImportReviewComplete(draft, appliedSelection)) {
        setPhase("applied");
        await dismissCurrentJob();
      }
      onApplied?.();
    },
    [agentId, dismissCurrentJob, draft, onApplied, runApply],
  );

  const applyAllPending = useCallback(async () => {
    if (!draft || !selection) return;
    setApplyError(null);
    try {
      const payload = filterDraftForPendingApply(draft, selection);
      if (isEmptyDraft(payload)) {
        throw new Error("No remaining items to add.");
      }
      await applyWithSelection(payload, selection);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not save import.");
      throw err;
    }
  }, [applyWithSelection, draft, selection]);

  const acceptAndApply = useCallback(
    async (target: AgentKnowledgeImportApplyTarget) => {
      if (!draft || !selection) return;
      setApplyError(null);
      setApplyingTarget(target);
      try {
        const nextSelection = selectionForAcceptTarget(selection, target);
        const payload = buildPartialDraftForTarget(draft, nextSelection, target);
        if (!payload) {
          throw new Error("Could not add this item.");
        }
        setSelection(nextSelection);
        await applyWithSelection(payload, nextSelection);
      } catch (err) {
        setApplyError(err instanceof Error ? err.message : "Could not save import.");
        throw err;
      } finally {
        setApplyingTarget(null);
      }
    },
    [applyWithSelection, draft, selection],
  );

  const reset = useCallback(() => {
    void (async () => {
      await dismissCurrentJob();
      setPhase("upload");
      setJobId(null);
      setFiles([]);
      setTargets(["context", "skills", "templates"]);
      setFocusHint("");
      setDraft(null);
      setSelection(null);
      setWorkspaceRefs(createEmptyWorkspaceRefs());
      setApplyingTarget(null);
      setFileError(null);
      setGenerateError(null);
      setApplyError(null);
      onCleared?.();
    })();
  }, [dismissCurrentJob, onCleared]);

  const updateDraft = useCallback((next: AgentKnowledgeImportDraft) => {
    setDraft(next);
  }, []);

  const pendingCount = draft && selection ? countPendingItems(draft, selection) : 0;

  return {
    phase,
    jobId,
    files,
    targets,
    focusHint,
    draft,
    selection,
    applyingTarget,
    pendingCount,
    fileError,
    generateError,
    applyError,
    canGenerate,
    addFiles,
    removeFile,
    toggleTarget,
    setFocusHint,
    generate,
    reset,
    loadJob,
    applyAllPending,
    acceptAndApply,
    updateDraft,
    discardContextGroup: (groupId: string) =>
      setSelection((prev) => (prev ? discardContextGroup(prev, groupId) : prev)),
    discardContextFact: (groupId: string, factId: string) =>
      setSelection((prev) =>
        prev ? setContextFactDisposition(prev, groupId, factId, "discarded") : prev,
      ),
    discardTemplateGroup: (groupId: string) =>
      setSelection((prev) => (prev ? discardTemplateGroup(prev, groupId) : prev)),
    discardTemplateEntry: (groupId: string, entryId: string) =>
      setSelection((prev) =>
        prev ? setTemplateEntryDisposition(prev, groupId, entryId, "discarded") : prev,
      ),
    discardSkill: (skillId: string) =>
      setSelection((prev) => (prev ? setSkillDisposition(prev, skillId, "discarded") : prev)),
  };
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";

const mockStartJob = vi.fn();
const mockGetJob = vi.fn();
const mockApply = vi.fn();
const mockSaveJob = vi.fn();
const mockDismissJob = vi.fn();
const mockListJobs = vi.fn();

vi.mock("@/lib/agent-knowledge-import-api", () => ({
  startAgentKnowledgeImportJob: mockStartJob,
  getAgentKnowledgeImportJob: mockGetJob,
  saveAgentKnowledgeImportJobProgress: mockSaveJob,
  applyAgentKnowledgeImport: mockApply,
  listAgentKnowledgeImportJobs: mockListJobs,
  dismissAgentKnowledgeImportJob: mockDismissJob,
}));

const DRAFT: AgentKnowledgeImportDraft = {
  contextGroups: [
    {
      id: "g1",
      name: "Imported",
      facts: [{ id: "f1", title: "Hours", bodyText: "9-5" }],
    },
  ],
  skills: [],
  templateGroups: [],
};

const SELECTION = {
  contextGroups: { g1: { disposition: "pending", facts: { f1: "pending" } } },
  skills: {},
  templateGroups: {},
};

const { useAgentKnowledgeImport } = await import("@/hooks/useAgentKnowledgeImport");

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveJob.mockResolvedValue({ ok: true });
  mockDismissJob.mockResolvedValue({ ok: true });
  mockListJobs.mockResolvedValue({ jobs: [] });
});

describe("useAgentKnowledgeImport", () => {
  // Generate should queue a background job and enter processing.
  it("generate starts background job and enters processing", async () => {
    mockStartJob.mockResolvedValue({
      ok: true,
      job: {
        id: "job-1",
        status: "queued",
        profileName: "Support",
        targets: ["context"],
        focusHint: "",
        fileCount: 1,
        draft: null,
        selection: null,
        workspaceRefs: { contextGroups: {}, templateGroups: {} },
        errorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    mockGetJob.mockResolvedValue({
      ok: true,
      job: {
        id: "job-1",
        status: "ready",
        profileName: "Support",
        targets: ["context"],
        focusHint: "",
        fileCount: 1,
        draft: DRAFT,
        selection: SELECTION,
        workspaceRefs: { contextGroups: {}, templateGroups: {} },
        errorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const { result } = renderHook(() =>
      useAgentKnowledgeImport({ agentId: "agent-1", profileName: "Support" }),
    );

    const file = new File(["# Hours"], "hours.md", { type: "text/markdown" });

    await act(async () => {
      result.current.addFiles([file]);
    });
    await act(async () => {
      await result.current.generate();
    });

    expect(mockStartJob).toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.phase).toBe("review");
    expect(result.current.draft?.contextGroups[0].name).toBe("Imported");
  });

  // Apply-all should send remaining draft with job metadata.
  it("applyAllPending sends pending draft and enters applied phase", async () => {
    mockGetJob.mockResolvedValue({
      ok: true,
      job: {
        id: "job-1",
        status: "ready",
        profileName: "Support",
        targets: ["context"],
        focusHint: "",
        fileCount: 1,
        draft: DRAFT,
        selection: SELECTION,
        workspaceRefs: { contextGroups: {}, templateGroups: {} },
        errorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    mockApply.mockResolvedValue({
      ok: true,
      workspaceRefs: { contextGroups: { g1: "ctx-db-1" }, templateGroups: {} },
    });
    const onApplied = vi.fn();

    const { result } = renderHook(() =>
      useAgentKnowledgeImport({
        agentId: "agent-1",
        profileName: "Support",
        resumeJobId: "job-1",
        onApplied,
      }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await result.current.applyAllPending();
    });

    expect(mockApply).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({
        profileName: "Support",
        draft: DRAFT,
        jobId: "job-1",
      }),
    );
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("applied");
    expect(mockDismissJob).toHaveBeenCalledWith("agent-1", "job-1");
  });

  // Reopening Import docs with no resume id must still attach to the single in-flight job.
  it("auto-resumes a processing job when opened without resumeJobId", async () => {
    mockListJobs.mockResolvedValue({
      jobs: [
        {
          id: "job-running",
          status: "processing",
          profileName: "Support",
          targets: ["context"],
          focusHint: "",
          fileCount: 1,
          draft: null,
          selection: null,
          workspaceRefs: { contextGroups: {}, templateGroups: {} },
          errorMessage: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    mockGetJob.mockResolvedValue({
      ok: true,
      job: {
        id: "job-running",
        status: "processing",
        profileName: "Support",
        targets: ["context"],
        focusHint: "",
        fileCount: 1,
        draft: null,
        selection: null,
        workspaceRefs: { contextGroups: {}, templateGroups: {} },
        errorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const { result } = renderHook(() =>
      useAgentKnowledgeImport({ agentId: "agent-1", profileName: "Support" }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockListJobs).toHaveBeenCalledWith("agent-1");
    expect(mockGetJob).toHaveBeenCalledWith("agent-1", "job-running");
    expect(result.current.phase).toBe("processing");
    expect(result.current.jobId).toBe("job-running");
  });

  // Discarding the last review item must clear Import ready and return to upload (no empty 0-count UI).
  it("discarding the last pending item dismisses the job and resets to upload", async () => {
    mockGetJob.mockResolvedValue({
      ok: true,
      job: {
        id: "job-1",
        status: "ready",
        profileName: "Support",
        targets: ["context"],
        focusHint: "",
        fileCount: 1,
        draft: DRAFT,
        selection: SELECTION,
        workspaceRefs: { contextGroups: {}, templateGroups: {} },
        errorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const onCleared = vi.fn();

    const { result } = renderHook(() =>
      useAgentKnowledgeImport({
        agentId: "agent-1",
        profileName: "Support",
        resumeJobId: "job-1",
        onCleared,
      }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.phase).toBe("review");
    expect(result.current.pendingCount).toBe(1);

    await act(async () => {
      result.current.discardContextFact("g1", "f1");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockDismissJob).toHaveBeenCalledWith("agent-1", "job-1");
    expect(onCleared).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("upload");
    expect(result.current.jobId).toBeNull();
    expect(result.current.draft).toBeNull();
    expect(result.current.pendingCount).toBe(0);
  });

  // Back / clear must dismiss the ready job so the agent list badge does not keep showing Import ready.
  it("reset dismisses the current job and notifies onCleared", async () => {
    mockGetJob.mockResolvedValue({
      ok: true,
      job: {
        id: "job-1",
        status: "ready",
        profileName: "Support",
        targets: ["context"],
        focusHint: "",
        fileCount: 1,
        draft: DRAFT,
        selection: SELECTION,
        workspaceRefs: { contextGroups: {}, templateGroups: {} },
        errorMessage: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const onCleared = vi.fn();

    const { result } = renderHook(() =>
      useAgentKnowledgeImport({
        agentId: "agent-1",
        profileName: "Support",
        resumeJobId: "job-1",
        onCleared,
      }),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.phase).toBe("review");

    await act(async () => {
      result.current.reset();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockDismissJob).toHaveBeenCalledWith("agent-1", "job-1");
    expect(onCleared).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("upload");
    expect(result.current.jobId).toBeNull();
  });
});

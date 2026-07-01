import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";

const mockStartJob = vi.fn();
const mockGetJob = vi.fn();
const mockApply = vi.fn();
const mockSaveJob = vi.fn();

vi.mock("@/lib/agent-knowledge-import-api", () => ({
  startAgentKnowledgeImportJob: mockStartJob,
  getAgentKnowledgeImportJob: mockGetJob,
  saveAgentKnowledgeImportJobProgress: mockSaveJob,
  applyAgentKnowledgeImport: mockApply,
  listAgentKnowledgeImportJobs: vi.fn(),
  dismissAgentKnowledgeImportJob: vi.fn(),
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
  });
});

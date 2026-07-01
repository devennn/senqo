import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentKnowledgeImportDraft } from "@/types/agent-knowledge-import";

const mockPostForm = vi.fn();
const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: mockGet,
    post: mockPost,
    postForm: mockPostForm,
    patch: mockPatch,
    put: vi.fn(),
    delete: vi.fn(),
  },
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agent knowledge import API client", () => {
  // Background job start should post multipart form data to jobs route.
  it("startAgentKnowledgeImportJob sends multipart fields to jobs route", async () => {
    mockPostForm.mockResolvedValue({
      ok: true,
      job: { id: "job-1", status: "queued" },
    });

    const { startAgentKnowledgeImportJob } = await import("@/lib/agent-knowledge-import-api");
    const file = new File(["# Hours"], "hours.md", { type: "text/markdown" });

    await startAgentKnowledgeImportJob("agent-42", {
      profileName: "Support",
      targets: ["context", "templates"],
      focusHint: "hours only",
      files: [file],
    });

    expect(mockPostForm).toHaveBeenCalledTimes(1);
    const [url, formData] = mockPostForm.mock.calls[0] as [string, FormData];
    expect(url).toBe("/api/user/agents/agent-42/knowledge-import/jobs");
    expect(formData.get("profileName")).toBe("Support");
    expect(formData.getAll("files")).toHaveLength(1);
  });

  // Apply should post JSON draft payload to the per-agent apply route.
  it("applyAgentKnowledgeImport posts draft JSON to apply route", async () => {
    mockPost.mockResolvedValue({
      ok: true,
      workspaceRefs: { contextGroups: {}, templateGroups: {} },
    });

    const { applyAgentKnowledgeImport } = await import("@/lib/agent-knowledge-import-api");

    const result = await applyAgentKnowledgeImport("agent-42", {
      profileName: "Support",
      draft: DRAFT,
      jobId: "job-1",
    });

    expect(result.ok).toBe(true);
    expect(mockPost).toHaveBeenCalledWith("/api/user/agents/agent-42/knowledge-import/apply", {
      profileName: "Support",
      draft: DRAFT,
      jobId: "job-1",
    });
  });
});

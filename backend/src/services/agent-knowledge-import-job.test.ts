import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/job-queue.js", () => ({
  getBoss: vi.fn(),
  QUEUE_AGENT_KNOWLEDGE_IMPORT: "agent-knowledge-import",
}));

vi.mock("../lib/storage.js", () => ({
  storageUpload: vi.fn(),
}));

vi.mock("../repositories/agent-knowledge-import-jobs.js", () => ({
  createAgentKnowledgeImportJob: vi.fn(),
  dismissAgentKnowledgeImportJob: vi.fn(),
  getAgentKnowledgeImportJobById: vi.fn(),
  listActiveAgentKnowledgeImportJobs: vi.fn(),
  markAgentKnowledgeImportJobFailed: vi.fn(),
  updateAgentKnowledgeImportJobState: vi.fn(),
}));

import { listActiveAgentKnowledgeImportJobs } from "../repositories/agent-knowledge-import-jobs.js";
import { startAgentKnowledgeImportJob } from "./agent-knowledge-import-job.js";

const listActiveMock = vi.mocked(listActiveAgentKnowledgeImportJobs);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startAgentKnowledgeImportJob", () => {
  // Only one import may run per agent — a second start must fail while queued/processing/ready exists.
  it("rejects start when an import is already active", async () => {
    listActiveMock.mockResolvedValue([
      {
        id: "job-existing",
        status: "processing",
        profile_name: "Support",
        file_count: 1,
        error_message: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const file = new File(["# Hours"], "hours.md", { type: "text/markdown" });
    const result = await startAgentKnowledgeImportJob({
      workspaceId: "ws-1",
      agentId: "agent-1",
      profileName: "Support",
      focusHint: "",
      targetsJson: JSON.stringify(["context"]),
      files: [file],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("import_job_already_active");
      expect(result.jobId).toBe("job-existing");
      expect(result.message).toBe("An import is already in progress for this agent.");
    }
  });
});

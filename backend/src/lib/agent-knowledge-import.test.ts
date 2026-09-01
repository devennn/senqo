import { describe, expect, it } from "vitest";
import {
  validateAgentKnowledgeImportFileMeta,
  validateAgentKnowledgeImportPreviewInput,
} from "../lib/agent-knowledge-import.js";

describe("validateAgentKnowledgeImportPreviewInput", () => {
  // Rejects empty uploads so the route never calls extraction or the LLM.
  it("returns error when no files are provided", () => {
    const result = validateAgentKnowledgeImportPreviewInput({
      focusHint: "",
      targetsJson: JSON.stringify(["context"]),
      files: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("At least one file is required.");
    }
  });

  // Accepts valid multipart metadata before async preview work runs.
  it("returns targets and file metadata for valid payload", () => {
    const file = new File(["name,price\na,1"], "prices.csv", { type: "text/csv" });
    const result = validateAgentKnowledgeImportPreviewInput({
      focusHint: "pricing",
      targetsJson: JSON.stringify(["context", "skills"]),
      files: [file],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targets).toEqual(["context", "skills"]);
      expect(result.files[0]?.name).toBe("prices.csv");
    }
  });

  // A file over the 20 MB per-file cap is rejected before preview work starts.
  it("returns exceeds 20 MB when a file is over the per-file cap", () => {
    const result = validateAgentKnowledgeImportFileMeta({
      name: "big.pdf",
      size: 20 * 1024 * 1024 + 1,
      mimeType: "application/pdf",
    });
    expect(result).toEqual({ ok: false, message: "big.pdf: exceeds 20 MB limit." });
  });
});

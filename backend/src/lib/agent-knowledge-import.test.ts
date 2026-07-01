import { describe, expect, it } from "vitest";
import { validateAgentKnowledgeImportPreviewInput } from "../lib/agent-knowledge-import.js";

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
});

import { describe, expect, it } from "vitest";
import { extractAgentKnowledgeImportDocuments } from "./agent-knowledge-import-extract.js";

describe("extractAgentKnowledgeImportDocuments", () => {
  // Markdown uploads should return UTF-8 text for the LLM prompt.
  it("extracts markdown file text", async () => {
    const result = await extractAgentKnowledgeImportDocuments([
      {
        name: "guide.md",
        mimeType: "text/markdown",
        data: Buffer.from("# Hours\nMon-Fri 9-5"),
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.documents[0]?.text).toContain("Mon-Fri 9-5");
    }
  });

  // CSV uploads should be normalized to JSON rows for the model.
  it("extracts csv rows as json", async () => {
    const result = await extractAgentKnowledgeImportDocuments([
      {
        name: "prices.csv",
        mimeType: "text/csv",
        data: Buffer.from("name,price\nWidget,10"),
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.documents[0]?.text).toContain("Widget");
    }
  });
});

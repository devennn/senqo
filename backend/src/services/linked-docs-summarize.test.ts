import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateText = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: {
    object: (opts: unknown) => opts,
  },
}));

vi.mock("../agent/llm.js", () => ({
  getFormatterLLM: () => "mock-model",
}));

describe("extractTextPreviewForSummary", () => {
  // Text/csv bytes become a utf-8 excerpt for the summarizer.
  it("decodes text-like uploads", async () => {
    const { extractTextPreviewForSummary } = await import(
      "./linked-docs-summarize.js"
    );
    const text = extractTextPreviewForSummary({
      fileName: "stock.csv",
      mimeType: "text/csv",
      bytes: new TextEncoder().encode("sku,qty\nA,10"),
    });
    expect(text).toContain("sku,qty");
    expect(text).toContain("A,10");
  });

  // Binary files get a short notice so the model still has fileName/mime context.
  it("returns binary notice for office mime types", async () => {
    const { extractTextPreviewForSummary } = await import(
      "./linked-docs-summarize.js"
    );
    const text = extractTextPreviewForSummary({
      fileName: "menu.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(text).toContain("Binary/office file menu.pdf");
    expect(text).toContain("3 bytes");
  });
});

describe("summarizeLinkedDocContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Happy path returns a trimmed agent-facing description from the model.
  it("returns description from structured LLM output", async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: {
        description:
          "  Kitchen inventory CSV with sku and qty columns. Use to answer current stock levels via readLinkedDoc.  ",
      },
    });
    const { summarizeLinkedDocContent } = await import(
      "./linked-docs-summarize.js"
    );
    const result = await summarizeLinkedDocContent({
      fileName: "stock.csv",
      mimeType: "text/csv",
      excerpt: "sku,qty\nA,10",
    });
    expect(result).toEqual({
      ok: true,
      description:
        "Kitchen inventory CSV with sku and qty columns. Use to answer current stock levels via readLinkedDoc.",
    });
  });

  // Empty file name should fail before calling the model.
  it("rejects empty file name", async () => {
    const { summarizeLinkedDocContent } = await import(
      "./linked-docs-summarize.js"
    );
    const result = await summarizeLinkedDocContent({
      fileName: "  ",
      mimeType: "text/csv",
      excerpt: "a",
    });
    expect(result).toEqual({ ok: false, message: "File name is required." });
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // Model failures surface as summarize_failed for the UI.
  it("returns failure when generateText throws", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("rate limit"));
    const { summarizeLinkedDocContent } = await import(
      "./linked-docs-summarize.js"
    );
    const result = await summarizeLinkedDocContent({
      fileName: "stock.csv",
      mimeType: "text/csv",
      excerpt: "sku,qty",
    });
    expect(result).toEqual({
      ok: false,
      message: "Could not summarize file.",
    });
  });
});

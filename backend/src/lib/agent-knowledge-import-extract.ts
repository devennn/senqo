import Papa from "papaparse";
import { PDFParse } from "pdf-parse";

const MAX_CHARS = 50_000;
const scope = "AgentKnowledgeImportExtract";

export type ExtractedDocument = {
  name: string;
  text: string;
};

function truncate(text: string): string {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
}

async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const result = await parser.getText();
    return truncate(result.text.trim());
  } finally {
    await parser.destroy();
  }
}

function extractCsvText(data: ArrayBuffer): string {
  const raw = Buffer.from(data).toString("utf8");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    return truncate(raw);
  }
  return truncate(JSON.stringify(parsed.data, null, 2));
}

export async function extractAgentKnowledgeImportDocuments(
  files: { name: string; data: ArrayBuffer; mimeType: string }[],
): Promise<{ ok: true; documents: ExtractedDocument[] } | { ok: false; message: string }> {
  try {
    const documents: ExtractedDocument[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let text = "";

      if (ext === "md") {
        text = truncate(Buffer.from(file.data).toString("utf8").trim());
      } else if (ext === "csv") {
        text = extractCsvText(file.data);
      } else if (ext === "pdf") {
        text = await extractPdfText(file.data);
      } else {
        return { ok: false, message: `${file.name}: unsupported file type.` };
      }

      if (!text.trim()) {
        return { ok: false, message: `${file.name}: no readable text found.` };
      }

      documents.push({ name: file.name, text });
    }

    console.info(`[${scope}/extract] Success: fileCount=${documents.length}`);
    return { ok: true, documents };
  } catch (error) {
    console.error(`[${scope}/extract] Unexpected error: ${String(error)}`);
    return { ok: false, message: "Could not read uploaded files." };
  }
}

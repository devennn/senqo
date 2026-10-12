import * as XLSX from "xlsx";

const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";
const DOCS_MIME = "application/vnd.google-apps.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PLAIN_TEXT_MIME = "text/plain";

/** Prefer data tabs before meta tabs so inventory fits in the char budget. */
function orderSheetNames(names: string[]): string[] {
  const isMeta = (name: string) =>
    /^(readme|read\s*me|notes|instructions|about|index|toc|cover)$/i.test(
      name.trim(),
    );
  return [
    ...names.filter((n) => !isMeta(n)),
    ...names.filter((n) => isMeta(n)),
  ];
}

/** Convert an XLSX/XLS workbook buffer into labeled CSV text for every sheet. */
export function workbookBytesToText(bytes: Uint8Array): string {
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
  const names = orderSheetNames(workbook.SheetNames ?? []);
  const parts: string[] = [];
  for (const name of names) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (!csv) continue;
    parts.push(`=== Sheet: ${name} ===\n${csv}`);
  }
  return parts.join("\n\n");
}

/** Export MIME for Google Workspace files so multi-tab sheets are included. */
export function driveExportMimeType(mimeType: string | undefined): string | null {
  const mime = (mimeType ?? "").trim().toLowerCase();
  if (mime === SPREADSHEET_MIME) return XLSX_MIME;
  if (mime === DOCS_MIME) return PLAIN_TEXT_MIME;
  return null;
}

export function isGoogleSpreadsheetMime(mimeType: string | undefined): boolean {
  return (mimeType ?? "").trim().toLowerCase() === SPREADSHEET_MIME;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/** Pull text, base64, or a staged download URL from a Composio Drive download payload. */
export function extractDriveDownloadPayload(result: Record<string, unknown>): {
  text?: string;
  base64?: string;
  url?: string;
} {
  const root =
    result.data && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : result;

  const fileContent =
    asRecord(root.downloaded_file_content) ??
    asRecord(root.downloadedFileContent) ??
    asRecord(root.file) ??
    null;

  const urlCandidates = [
    fileContent?.s3url,
    fileContent?.s3Url,
    fileContent?.url,
    root.s3url,
    root.url,
  ];
  for (const candidate of urlCandidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return { url: candidate };
    }
  }

  const textCandidates = [
    root.content,
    root.text,
    root.body,
    fileContent?.content,
    fileContent?.text,
  ];
  for (const candidate of textCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      // Staged path strings from auto-download are not useful as sheet text.
      if (candidate.startsWith("/") && candidate.length < 512) continue;
      return { text: candidate };
    }
  }

  const base64Candidates = [
    fileContent?.base64,
    fileContent?.data,
    root.base64,
  ];
  for (const candidate of base64Candidates) {
    if (typeof candidate === "string" && candidate.length > 32) {
      return { base64: candidate };
    }
  }

  return {};
}

export async function fetchUrlBytes(
  url: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not fetch Drive export (${res.status})`,
      };
    }
    return { ok: true, bytes: new Uint8Array(await res.arrayBuffer()) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Fetch failed",
    };
  }
}

export { XLSX_MIME, PLAIN_TEXT_MIME, SPREADSHEET_MIME };

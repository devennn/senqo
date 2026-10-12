import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  driveExportMimeType,
  extractDriveDownloadPayload,
  workbookBytesToText,
} from "./drive-file-text.js";

function buildWorkbook(sheets: Record<string, string[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("driveExportMimeType", () => {
  // Native Sheets must export as XLSX so every tab is included (CSV is first-tab only).
  it("driveExportMimeType → returns XLSX mime for Google Spreadsheets", () => {
    expect(driveExportMimeType("application/vnd.google-apps.spreadsheet")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  // Docs export as plain text for agent-readable content.
  it("driveExportMimeType → returns text/plain for Google Docs", () => {
    expect(driveExportMimeType("application/vnd.google-apps.document")).toBe(
      "text/plain",
    );
  });

  // Blob files leave mime unset so Drive returns original bytes.
  it("driveExportMimeType → returns null for csv uploads", () => {
    expect(driveExportMimeType("text/csv")).toBeNull();
  });
});

describe("workbookBytesToText", () => {
  // Inventory must appear before README so truncation keeps stock rows.
  it("workbookBytesToText → lists data sheets before README and includes both", () => {
    const bytes = buildWorkbook({
      README: [["How to use"], ["See Inventory"]],
      Inventory: [
        ["Product", "Qty"],
        ["Raw Coconut Oil", "12"],
      ],
    });
    const text = workbookBytesToText(bytes);
    expect(text).toContain("=== Sheet: Inventory ===");
    expect(text).toContain("Raw Coconut Oil,12");
    expect(text).toContain("=== Sheet: README ===");
    expect(text.indexOf("Inventory")).toBeLessThan(text.indexOf("README"));
  });
});

describe("extractDriveDownloadPayload", () => {
  // Composio stages downloads at downloaded_file_content.s3url.
  it("extractDriveDownloadPayload → prefers staged s3url", () => {
    expect(
      extractDriveDownloadPayload({
        successful: true,
        data: {
          downloaded_file_content: {
            s3url: "https://example.com/file.xlsx",
          },
        },
      }),
    ).toEqual({ url: "https://example.com/file.xlsx" });
  });
});

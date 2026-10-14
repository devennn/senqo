import { describe, expect, it } from "vitest";
import { googleDriveOpenUrl } from "./google-drive-open-url.js";

describe("googleDriveOpenUrl", () => {
  // Sheets must open in the spreadsheet editor so inventory files are editable in Drive.
  it("googleDriveOpenUrl → returns Sheets editor URL for spreadsheet mime", () => {
    expect(
      googleDriveOpenUrl(
        "abc123",
        "application/vnd.google-apps.spreadsheet",
      ),
    ).toBe("https://docs.google.com/spreadsheets/d/abc123/edit");
  });

  // Generic binary files fall back to the Drive viewer rather than a Workspace app.
  it("googleDriveOpenUrl → returns Drive viewer URL for unknown mime", () => {
    expect(googleDriveOpenUrl("file-9", "application/pdf")).toBe(
      "https://drive.google.com/file/d/file-9/view",
    );
  });

  // Empty ids must not invent a broken Google URL for the UI Open link.
  it("googleDriveOpenUrl → returns empty string when file id is blank", () => {
    expect(googleDriveOpenUrl("  ", "application/pdf")).toBe("");
  });
});

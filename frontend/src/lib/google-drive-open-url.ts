/** Public Google Workspace / Drive URL for opening a file in a new tab. */
export function googleDriveOpenUrl(
  driveFileId: string,
  mimeType: string,
): string {
  const id = driveFileId.trim();
  const mime = mimeType.trim().toLowerCase();
  if (!id) return "";

  if (mime === "application/vnd.google-apps.document") {
    return `https://docs.google.com/document/d/${id}/edit`;
  }
  if (mime === "application/vnd.google-apps.spreadsheet") {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
  if (mime === "application/vnd.google-apps.presentation") {
    return `https://docs.google.com/presentation/d/${id}/edit`;
  }
  if (mime === "application/vnd.google-apps.form") {
    return `https://docs.google.com/forms/d/${id}/edit`;
  }
  if (mime === "application/vnd.google-apps.drawing") {
    return `https://docs.google.com/drawings/d/${id}/edit`;
  }
  return `https://drive.google.com/file/d/${id}/view`;
}

import { GoogleDriveIcon } from "@/components/icons/google-drive-icon";
import {
  ExcelTypeIcon,
  GoogleDocsTypeIcon,
  GoogleFolderTypeIcon,
  GoogleFormsTypeIcon,
  GooglePdfTypeIcon,
  GoogleSheetsTypeIcon,
  GoogleSlidesTypeIcon,
  WordTypeIcon,
} from "@/components/icons/google-workspace-type-icons";

type Props = {
  mimeType: string;
  className?: string;
};

/** Icon for a Drive item based on Google/Office mime type. */
export function GoogleDriveFileIcon({ mimeType, className }: Props) {
  const mime = mimeType.trim().toLowerCase();

  if (mime === "application/vnd.google-apps.folder") {
    return <GoogleFolderTypeIcon className={className} />;
  }
  if (mime === "application/vnd.google-apps.document") {
    return <GoogleDocsTypeIcon className={className} />;
  }
  if (mime === "application/vnd.google-apps.spreadsheet") {
    return <GoogleSheetsTypeIcon className={className} />;
  }
  if (mime === "application/vnd.google-apps.presentation") {
    return <GoogleSlidesTypeIcon className={className} />;
  }
  if (mime === "application/vnd.google-apps.form") {
    return <GoogleFormsTypeIcon className={className} />;
  }
  if (mime === "application/pdf") {
    return <GooglePdfTypeIcon className={className} />;
  }
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) {
    return <WordTypeIcon className={className} />;
  }
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  ) {
    return <ExcelTypeIcon className={className} />;
  }

  return (
    <GoogleDriveIcon
      className={className}
      title={mime.startsWith("image/") ? "Image" : "Drive file"}
    />
  );
}

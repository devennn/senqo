import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleDriveIcon } from "@/components/icons/google-drive-icon";
import { useWorkspaceApps, type DriveFileListItem } from "@/hooks/useWorkspaceApps";
import { cn } from "@/lib/utils";
import { AssetDriveFilePicker } from "@/pages/dashboard/components/asset-drive-file-picker";
import { FileText, Send, Upload } from "lucide-react";

export type AssetAddKind = "file" | "doc";
export type AssetAddDocSource = "upload" | "google_drive";

type Props = {
  open: boolean;
  kind: AssetAddKind;
  docSource: AssetAddDocSource;
  selectedDrive: DriveFileListItem | null;
  disabled: boolean;
  onKindChange: (kind: AssetAddKind) => void;
  onDocSourceChange: (source: AssetAddDocSource) => void;
  onFileChange: (file: File | null) => void;
  onDriveSelect: (file: DriveFileListItem) => void;
};

const FILE_ACCEPT =
  "image/*,video/*,audio/*,.pdf,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";
const DOC_ACCEPT = ".pdf,.csv,.doc,.docx,.xls,.xlsx,.txt,.md";

/**
 * Add asset inputs: first what the agent should do with the item (send it, or re-read it live),
 * then — for live docs only — where it comes from (upload or Google Drive).
 */
export function AssetAddKindFields({
  open,
  kind,
  docSource,
  selectedDrive,
  disabled,
  onKindChange,
  onDocSourceChange,
  onFileChange,
  onDriveSelect,
}: Props) {
  const { apps } = useWorkspaceApps();
  const driveApp = apps.find((a) => a.toolkit === "googledrive");
  const driveConnected = driveApp?.status === "active";
  const [fileResetKey, setFileResetKey] = useState(0);

  useEffect(() => {
    if (!open) setFileResetKey((key) => key + 1);
  }, [open]);

  const fileInput = (label: string, accept: string) => (
    <div className="min-w-0 space-y-2">
      <Label htmlFor="asset-add-file">{label}</Label>
      <Input
        key={`${kind}-${docSource}-${fileResetKey}`}
        id="asset-add-file"
        type="file"
        className="w-full max-w-full"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="What the agent should do with it" className="space-y-2">
        <KindOption
          selected={kind === "file"}
          onSelect={() => onKindChange("file")}
          icon={<Send className="size-4" />}
          title="Sendable file"
          description="The agent can send it to customers on WhatsApp."
        />
        <KindOption
          selected={kind === "doc"}
          onSelect={() => onKindChange("doc")}
          icon={<FileText className="size-4" />}
          title="Live doc"
          description="The agent re-reads the latest content whenever a chat needs it."
        />
      </div>

      {kind === "doc" ? (
        <>
          <div className="space-y-2">
            <Label>Source</Label>
            <div
              role="tablist"
              aria-label="Live doc source"
              className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1"
            >
              <SourceTab
                selected={docSource === "upload"}
                onClick={() => onDocSourceChange("upload")}
              >
                <Upload className="size-3.5" />
                Upload file
              </SourceTab>
              <SourceTab
                selected={docSource === "google_drive"}
                onClick={() => onDocSourceChange("google_drive")}
              >
                <GoogleDriveIcon className="size-3.5" decorative />
                Google Drive
              </SourceTab>
            </div>
          </div>
          {docSource === "upload" ? (
            fileInput("Document (PDF, CSV, Office, text)", DOC_ACCEPT)
          ) : (
            <AssetDriveFilePicker
              open={open}
              selected={selectedDrive}
              driveConnected={driveConnected}
              accessLabel={driveApp?.accessLabel}
              disabled={disabled}
              onSelect={onDriveSelect}
            />
          )}
        </>
      ) : (
        fileInput("File", FILE_ACCEPT)
      )}
    </div>
  );
}

function KindOption(props: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors",
        props.selected ? "border-primary bg-primary/5" : "border-border/70 hover:border-border",
      )}
    >
      <input
        type="radio"
        name="asset-add-kind"
        className="mt-1"
        checked={props.selected}
        onChange={props.onSelect}
      />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
        {props.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{props.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{props.description}</span>
      </span>
    </label>
  );
}

function SourceTab(props: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.selected}
      onClick={props.onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        props.selected
          ? "bg-primary font-semibold text-primary-foreground"
          : "font-medium text-muted-foreground hover:bg-background/70 hover:text-foreground",
      )}
    >
      {props.children}
    </button>
  );
}

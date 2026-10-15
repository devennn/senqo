import { useEffect, useState } from "react";
import {
  ASSET_ABOUT_DESCRIPTION_PLACEHOLDER,
  AssetAboutDescriptionLabel,
} from "@/pages/dashboard/components/agent-asset-about-description";
import { AgentAssetRowActions } from "@/pages/dashboard/components/agent-asset-row-actions";
import { AgentAssetThumb } from "@/pages/dashboard/components/agent-asset-thumb";
import { GoogleDriveFileIcon } from "@/components/icons/google-drive-file-icon";
import { GoogleDriveIcon } from "@/components/icons/google-drive-icon";
import { Textarea } from "@/components/ui/textarea";
import type { AgentAssetRecord } from "@/types/repositories";
import { ExternalLink, Upload } from "lucide-react";

type Props = {
  asset: AgentAssetRecord;
  onSaveDescription: (assetId: string, description: string) => Promise<void>;
  /** Optional AI rewrite of the description; fills the draft for the operator to save. */
  onSummarize?: (assetId: string) => Promise<string>;
  onDelete: (assetId: string) => Promise<void>;
};

export function AgentAssetRow({
  asset,
  onSaveDescription,
  onSummarize,
  onDelete,
}: Props) {
  const [description, setDescription] = useState(asset.description);
  useEffect(() => {
    setDescription(asset.description);
  }, [asset.id, asset.description]);
  const dirty = description.trim() !== asset.description.trim();
  const isDoc = asset.kind === "doc";
  const openUrl = asset.open_url?.trim() || null;

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {isDoc ? (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
            <GoogleDriveFileIcon mimeType={asset.mime_type} className="size-6" />
          </div>
        ) : (
          <AgentAssetThumb
            mimeType={asset.mime_type}
            previewUrl={asset.preview_url}
            fileName={asset.file_name}
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-foreground">{asset.file_name}</p>
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
              {isDoc ? "Reference" : "Sendable file"}
            </span>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {isDoc ? (
              <>
                {asset.source === "google_drive" ? (
                  <GoogleDriveIcon className="size-3.5" decorative />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {asset.source === "google_drive" ? "Google Drive" : "Upload"}
                {openUrl ? (
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                  >
                    Open
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </>
            ) : (
              asset.mime_type
            )}
          </p>
          <AssetAboutDescriptionLabel
            htmlFor={`asset-about-${asset.id}`}
            labelClassName="text-xs text-muted-foreground"
          />
          <Textarea
            id={`asset-about-${asset.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={ASSET_ABOUT_DESCRIPTION_PLACEHOLDER}
            rows={2}
            className="resize-y text-sm"
            maxLength={2000}
            aria-label={`Description: ${asset.file_name}`}
          />
          <AgentAssetRowActions
            assetId={asset.id}
            fileName={asset.file_name}
            description={description}
            dirty={dirty}
            onSaveDescription={onSaveDescription}
            onSummarize={onSummarize}
            onDelete={onDelete}
            onDraftChange={setDescription}
          />
        </div>
      </div>
    </li>
  );
}

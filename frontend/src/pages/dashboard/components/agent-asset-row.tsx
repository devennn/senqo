import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSET_ABOUT_DESCRIPTION_PLACEHOLDER,
  AssetAboutDescriptionLabel,
} from "@/pages/dashboard/components/agent-asset-about-description";
import type { AgentAssetRecord } from "@/types/repositories";

type Props = {
  asset: AgentAssetRecord;
  onSaveDescription: (assetId: string, description: string) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
};

export function AgentAssetRow({ asset, onSaveDescription, onDelete }: Props) {
  const [description, setDescription] = useState(asset.description);
  useEffect(() => {
    setDescription(asset.description);
  }, [asset.id, asset.description]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = description.trim() !== asset.description.trim();

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveDescription(asset.id, description.trim());
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove "${asset.file_name}" from this agent?`)) return;
    setDeleting(true);
    try {
      await onDelete(asset.id);
    } finally {
      setDeleting(false);
    }
  }

  const isImage = asset.mime_type.startsWith("image/");

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {isImage && asset.preview_url ? (
          <img
            src={asset.preview_url}
            alt=""
            className="size-20 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground">
            {asset.mime_type.split("/")[0] ?? "file"}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate font-medium text-foreground">{asset.file_name}</p>
          <p className="text-xs text-muted-foreground">{asset.mime_type}</p>
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
            aria-label={`What is this file about: ${asset.file_name}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => { void handleSave(); }}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={() => { void handleDelete(); }}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSET_ABOUT_DESCRIPTION_PLACEHOLDER,
  AssetAboutDescriptionLabel,
} from "@/pages/dashboard/components/agent-asset-about-description";
import { validateWorkspaceAssetFile, workspaceAssetLimitsSummaryForUi } from "@/lib/workspace-asset-limits";

type Props = {
  disabled: boolean;
  onUpload: (file: File, description: string) => Promise<void>;
};

export function AgentAssetUploadForm({ disabled, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canUpload = !!selectedName && description.trim().length > 0 && !uploading && !disabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !canUpload) return;
    const fileCheck = validateWorkspaceAssetFile(file);
    if (!fileCheck.ok) {
      setUploadError(fileCheck.message);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await onUpload(file, description.trim());
      setDescription("");
      setSelectedName(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agent-asset-file">File</Label>
        <Input
          id="agent-asset-file"
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          disabled={disabled || uploading}
          onChange={(e) => setSelectedName(e.target.files?.[0]?.name ?? null)}
        />
        {selectedName ? (
          <p className="text-sm text-muted-foreground">Selected: {selectedName}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{workspaceAssetLimitsSummaryForUi()}.</p>
      </div>
      <div className="space-y-2">
        <AssetAboutDescriptionLabel htmlFor="agent-asset-description" />
        <p className="text-xs text-muted-foreground">Be specific—the AI uses this in its instructions.</p>
        <Textarea
          id="agent-asset-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={ASSET_ABOUT_DESCRIPTION_PLACEHOLDER}
          rows={3}
          className="resize-y"
          disabled={disabled || uploading}
          maxLength={2000}
        />
      </div>
      {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
      <Button type="submit" disabled={!canUpload}>
        {uploading ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}

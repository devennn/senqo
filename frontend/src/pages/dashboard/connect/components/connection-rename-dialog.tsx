import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN } from "@/lib/whatsapp-connection-limits";
import { TRANSIENT_SUCCESS_FEEDBACK_MS } from "@/lib/transient-feedback";
import { useTransientBooleanReset } from "@/hooks/useTransientBooleanReset";
import type { ConnectionRenameDialogProps } from "@/types/ui";

export function ConnectionRenameDialog({
  open,
  onOpenChange,
  connectionId,
  displayName,
  onSave,
}: ConnectionRenameDialogProps) {
  const [value, setValue] = useState(displayName);
  const [baseline, setBaseline] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  useTransientBooleanReset(showSaved, setShowSaved, TRANSIENT_SUCCESS_FEEDBACK_MS);

  useEffect(() => {
    if (!open) return;
    setValue(displayName);
    setBaseline(displayName);
    setError(null);
    setShowSaved(false);
  }, [open, displayName, connectionId]);

  const trimmed = value.trim();
  const baselineTrimmed = baseline.trim();
  const isDirty = trimmed !== baselineTrimmed;
  const isValid =
    trimmed.length > 0 && trimmed.length <= WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename connection</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN}
            placeholder="Connection name"
            autoComplete="off"
          />
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {showSaved ? (
            <p className="text-sm text-muted-foreground">Saved.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isDirty || !isValid || saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSave(trimmed);
                setBaseline(trimmed);
                setShowSaved(true);
              } catch {
                setError("Could not save. Try again.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

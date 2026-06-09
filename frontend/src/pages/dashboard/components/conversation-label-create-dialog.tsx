import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConversationLabelCreateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setDescription("");
  }

  async function handleSubmit() {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      await onCreate(n, description.trim());
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add label</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Descriptions help the AI choose matching chats when auto-assign is on.
        </p>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="dlg-label-name">Name</Label>
            <Input
              id="dlg-label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dlg-label-desc">Description</Label>
            <Textarea
              id="dlg-label-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When to use this label…"
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={saving || !name.trim()} onClick={() => void handleSubmit()}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
